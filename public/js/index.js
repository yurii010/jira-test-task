$(document).ready(function () {
  let tableData = {};
  let allAssignees = [];
  let statuses = [];
  const url = new URL(window.location.href).searchParams.get("xdm_e");

  // функція виведення заголовків таблиці
  function updateTableHeaders($tableHead, selectedStatus) {
    $tableHead.empty();
    $tableHead.append("<th>Name</th>");
    const statusList = selectedStatus ? [selectedStatus] : statuses.map((status) => status.name);
    statusList.forEach((status) => {
      $tableHead.append(`<th>${status}</th>`);
    });
  }

  // функція оновлення таблиці
  function updateTableBody($tableBody, filteredData, selectedStatus) {
    $tableBody.empty();
    filteredData.forEach((assignee) => {
      let rowHtml = `<tr><td class="assignee-td">${assignee.name}</td>`;
      const statusList = selectedStatus ? [selectedStatus] : statuses.map((status) => status.name);
      statusList.forEach((status) => {
        const issueCount = assignee.data[status] || 0;
        rowHtml += `<td><a class="link-adress" href="${url}/issues/?jql=status = '${status}' AND assignee ${
          assignee.name === "Unassigned" ? "is EMPTY" : `= '${assignee.name}'`
        }" target="_blank">${issueCount}</a></td>`;
      });
      rowHtml += "</tr>";
      $tableBody.append(rowHtml);
    });
  }

  // функція виведення таблиці
  function renderTable(filteredData, selectedStatus = null) {
    const $tableBody = $("#main-table tbody");
    const $tableHead = $("#main-table thead tr");
    updateTableHeaders($tableHead, selectedStatus);
    updateTableBody($tableBody, filteredData, selectedStatus);
  }

  // функція заповнення випадаючого списку
  function populateDropdown($dropdownMenu) {
    const $statusOptGroup = $('<optgroup label="Statuses"></optgroup>');
    statuses.forEach((status) => {
      $statusOptGroup.append(`<option class="dropdown-element" value="status-${status.name}">${status.name}</option>`);
    });
    $dropdownMenu.append($statusOptGroup);

    const $assigneeOptGroup = $('<optgroup label="Assignees"></optgroup>');
    allAssignees.forEach((assignee) => {
      $assigneeOptGroup.append(`<option class="dropdown-element" value="assignee-${assignee}">${assignee}</option>`);
    });
    $dropdownMenu.append($assigneeOptGroup);
  }

  // функція обробки зміни випадаючого списку
  function handleDropdownChange(initialData) {
    $("#dropdown-menu").on("change", function () {
      const selectedOption = $(this).val();
      let filteredData = [];
      let selectedStatus = null;

      if (selectedOption === "default") {
        filteredData = initialData;
      } else if (selectedOption.startsWith("status-")) {
        selectedStatus = selectedOption.replace("status-", "");
        filteredData = allAssignees.map((assignee) => ({
          name: assignee,
          data: { [selectedStatus]: tableData[assignee][selectedStatus] },
        }));
      } else if (selectedOption.startsWith("assignee-")) {
        const selectedAssignee = selectedOption.replace("assignee-", "");
        filteredData = [
          {
            name: selectedAssignee,
            data: tableData[selectedAssignee],
          },
        ];
      }
      renderTable(filteredData, selectedStatus);
    });
  }

  // запит на сервер
  $.ajax({
    url: `/get-data`,
    method: "GET",
    success: function (data) {
      statuses = data.statuses.sort((a, b) => a.id - b.id);
      allAssignees = [...data.assignees, "Unassigned"];

      allAssignees.forEach((assignee) => {
        tableData[assignee] = {};
        statuses.forEach((status) => {
          tableData[assignee][status.name] = 0;
        });
      });

      data.issues.forEach((issue) => {
        const assignee = issue.assignee || "Unassigned";
        const status = issue.status;
        if (tableData[assignee] && tableData[assignee][status] !== undefined) {
          tableData[assignee][status]++;
        }
      });

      const initialData = allAssignees.map((assignee) => ({
        name: assignee,
        data: tableData[assignee],
      }));

      renderTable(initialData);
      populateDropdown($("#dropdown-menu"));
      handleDropdownChange(initialData);
    },
    error: function () {
      console.error("Error fetching data.");
    },
  });
});