const fs = require("fs");
const axios = require("axios");
const url = require("url");
const jwt = require("atlassian-jwt");

module.exports = function (app, addon) {
  //fires after addon installation
  app.all("/installed", async function (req, res, next) {
    console.log("installation...");
    global.database.collection(global.JiraAccountInfoStore).findOne({ "installed.clientKey": req.body.clientKey }, function (err, result) {
      if (err) console.log(err);
      if (!result) {
        global.database.collection(global.JiraAccountInfoStore).insertOne(req.body, async (err, res) => {
          if (err) throw err;
          next();
        });
      } else {
        global.database
          .collection(global.JiraAccountInfoStore)
          .updateOne({ "installed.clientKey": req.body.clientKey }, { $set: req.body }, function (err, res) {
            next();
          });
      }
    });
  });

  app.get("/get-data", async (req, res) => {
    const baseUrl = new URL(req.headers["referer"]).searchParams.get("xdm_e");
    const keySecret = await global.database.collection(global.JiraAccountInfoStore).findOne({ baseUrl });

    const API_PATHS = {
      statuses: "/rest/api/3/status",
      assignees: (projectName) => `/rest/api/3/user/assignable/search?project=${projectName}`,
      issues: (projectName) => `/rest/api/3/search?jql=project=${projectName}`,
      projects: "/rest/api/3/project",
    };

    function createJwt(method, baseUrl, apiPath) {
      const requestUrl = url.parse(apiPath, baseUrl);
      const key = "test-addon";
      const issuedAt = Math.floor(Date.now() / 1000);
      const expiresAt = issuedAt + 180;
      const canonicalRequest = {
        method,
        path: requestUrl.pathname,
        query: requestUrl.query || "",
      };

      const qsh = jwt.createQueryStringHash(canonicalRequest, false);
      const claims = {
        iss: key,
        iat: issuedAt,
        exp: expiresAt,
        qsh,
      };

      return jwt.encode(claims, keySecret.sharedSecret);
    }

    async function fetchData(apiPath) {
      const token = createJwt("GET", baseUrl, apiPath);
      return axios.get(`${baseUrl}${apiPath}`, {
        headers: {
          Authorization: `JWT ${token}`,
          Accept: "application/json",
        },
      });
    }

    try {
      const responseProjects = await fetchData(API_PATHS.projects);
      const project = responseProjects.data.find((project) => project.self.includes(baseUrl));
      const projectName = project.key;

      const [responseStatuses, responseAssignees, responseIssues] = await Promise.all([
        fetchData(API_PATHS.statuses),
        fetchData(API_PATHS.assignees(projectName)),
        fetchData(API_PATHS.issues(projectName)),
      ]);

      const statuses = responseStatuses.data.map(({ id, name }) => ({ id, name }));
      const assignees = responseAssignees.data.map(({ displayName }) => displayName);
      const issues = responseIssues.data.issues.map((issue) => ({
        summary: issue.fields.summary,
        assignee: issue.fields.assignee ? issue.fields.assignee.displayName : "Unassigned",
        status: issue.fields.status.name,
      }));

      res.json({ statuses, assignees, issues });
    } catch (error) {
      console.error("Error fetching data:", error);
      res.status(500).json({ error: "Error fetching data: " + error.message });
    }
  });

  app.get("/", function (req, res) {
    res.format({
      "text/html": function () {
        res.redirect("/atlassian-connect.json");
      },
      "application/json": function () {
        res.redirect("/atlassian-connect.json");
      },
    });
  });

  app.get("/main-page", addon.authenticate(), async function (req, res) {
    res.render("main-page");
  });

  // load any additional files you have in routes and apply those to the app
  {
    var path = require("path");
    var files = fs.readdirSync("routes");
    for (var index in files) {
      var file = files[index];
      if (file === "index.js") continue;
      // skip non-javascript files
      if (path.extname(file) != ".js") continue;

      var routes = require("./" + path.basename(file));

      if (typeof routes === "function") {
        routes(app, addon);
      }
    }
  }
};