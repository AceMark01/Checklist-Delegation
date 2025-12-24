import { useState, useEffect } from "react"
import { BarChart3, CheckCircle2, Clock, ListTodo, Users, AlertTriangle, Filter, X, Search } from 'lucide-react'
import AdminLayout from "../../components/layout/AdminLayout.jsx"
import { useTranslation } from "../../contexts/TranslationContext"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from "recharts"

export default function AdminDashboard() {
  const { t } = useTranslation()
  const [dashboardType, setDashboardType] = useState("checklist")
  const [taskView, setTaskView] = useState("recent")
  const [filterStatus, setFilterStatus] = useState("all")
  const [filterStaff, setFilterStaff] = useState("all")
  const [searchQuery, setSearchQuery] = useState("")
  const [activeTab, setActiveTab] = useState("overview")

  // State for department data
  const [departmentData, setDepartmentData] = useState({
    allTasks: [],
    staffMembers: [],
    totalTasks: 0,
    completedTasks: 0,
    pendingTasks: 0,
    overdueTasks: 0,
    completionRate: 0,
    barChartData: [],
    pieChartData: [],
    // Add new counters for delegation mode
    completedRatingOne: 0,
    completedRatingTwo: 0,
    completedRatingThreePlus: 0
  })

  // Store the current date for overdue calculation
  const [currentDate, setCurrentDate] = useState(new Date())

  // New state for date range filtering
  const [dateRange, setDateRange] = useState({
    startDate: "",
    endDate: "",
    filtered: false
  });

  // State to store filtered statistics
  const [filteredDateStats, setFilteredDateStats] = useState({
    totalTasks: 0,
    completedTasks: 0,
    pendingTasks: 0,
    overdueTasks: 0,
    completionRate: 0
  });

  const [popupOpen, setPopupOpen] = useState(false)
  const [popupData, setPopupData] = useState([])
  const [popupType, setPopupType] = useState("")
  const [popupFilters, setPopupFilters] = useState({
    search: "",
    department: "all",
    givenBy: "all",
    name: "all",
    state: "all"
  })

  // Function to handle card click and set popup data
  const handleCardClick = (type) => {
    setPopupType(type)
    let filteredTasks = []
    switch (type) {
      case "total":
        filteredTasks = departmentData.allTasks || []
        break
      case "completed":
        filteredTasks = (departmentData.allTasks || []).filter(task => task.status === "completed")
        break
      case "pending":
        filteredTasks = (departmentData.allTasks || []).filter(task => task.status === "pending")
        break
      case "overdue":
        filteredTasks = (departmentData.allTasks || []).filter(task => task.status === "overdue")
        break
      default:
        filteredTasks = []
    }
    setPopupData(filteredTasks)
    setPopupFilters({
      search: "",
      department: "all",
      givenBy: "all",
      name: "all",
      state: "all"
    })
    setPopupOpen(true)
  }

  // Filter popup data based on filters
  const getFilteredPopupData = () => {
    return popupData.filter(task => {
      if (popupFilters.search && !task.title.toLowerCase().includes(popupFilters.search.toLowerCase())) {
        return false
      }
      if (popupFilters.department !== "all" && task.department !== popupFilters.department) return false
      if (popupFilters.givenBy !== "all" && task.givenBy !== popupFilters.givenBy) return false
      if (popupFilters.name !== "all" && task.name !== popupFilters.name) return false
      if (popupFilters.state !== "all" && task.state !== popupFilters.state) return false
      return true
    })
  }

  const handlePopupFilterChange = (filterKey, value) => {
    setPopupFilters(prev => ({
      ...prev,
      [filterKey]: value
    }))
  }

  const closePopup = () => {
    setPopupOpen(false)
    setPopupData([])
    setPopupType("")
  }

  // Helper function to format date from ISO format to DD/MM/YYYY
  const formatLocalDate = (isoDate) => {
    if (!isoDate) return "";
    const date = new Date(isoDate);
    return formatDateToDDMMYYYY(date);
  };

  // Function to filter tasks by date range
  const filterTasksByDateRange = () => {
    // Validate dates
    if (!dateRange.startDate || !dateRange.endDate) {
      alert("Please select both start and end dates");
      return;
    }

    const startDate = new Date(dateRange.startDate);
    startDate.setHours(0, 0, 0, 0);

    const endDate = new Date(dateRange.endDate);
    endDate.setHours(23, 59, 59, 999);

    if (startDate > endDate) {
      alert("Start date must be before end date");
      return;
    }

    // Filter tasks within the date range
    const filteredTasks = departmentData.allTasks.filter(task => {
      const taskStartDate = parseDateFromDDMMYYYY(task.taskStartDate);
      if (!taskStartDate) return false;

      return taskStartDate >= startDate && taskStartDate <= endDate;
    });

    // Count statistics
    let totalTasks = filteredTasks.length;
    let completedTasks = 0;
    let pendingTasks = 0;
    let overdueTasks = 0;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    filteredTasks.forEach(task => {
      if (task.status === 'completed') {
        completedTasks++;
      } else {
        // Task is not completed
        pendingTasks++; // All incomplete tasks count as pending

        if (task.status === 'overdue') {
          overdueTasks++; // Only past dates (excluding today) count as overdue
        }
      }
    });

    // Calculate completion rate
    const completionRate = totalTasks > 0 ? ((completedTasks / totalTasks) * 100).toFixed(1) : 0;

    // Update filtered stats
    setFilteredDateStats({
      totalTasks,
      completedTasks,
      pendingTasks,
      overdueTasks,
      completionRate
    });

    // Set filtered flag to true
    setDateRange(prev => ({ ...prev, filtered: true }));
  };

  // Format date as DD/MM/YYYY
  const formatDateToDDMMYYYY = (date) => {
    const day = date.getDate().toString().padStart(2, '0')
    const month = (date.getMonth() + 1).toString().padStart(2, '0')
    const year = date.getFullYear()
    return `${day}/${month}/${year}`
  }

  // Parse DD/MM/YYYY to Date object
  const parseDateFromDDMMYYYY = (dateStr) => {
    if (!dateStr || typeof dateStr !== 'string') return null
    const parts = dateStr.split('/')
    if (parts.length !== 3) return null
    return new Date(parts[2], parts[1] - 1, parts[0])
  }

  // Function to check if a date is in the past
  const isDateInPast = (dateStr) => {
    const date = parseDateFromDDMMYYYY(dateStr)
    if (!date) return false
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    return date < today
  }

  // Function to check if a date is today
  const isDateToday = (dateStr) => {
    const date = parseDateFromDDMMYYYY(dateStr)
    if (!date) return false
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    return date.getTime() === today.getTime()
  }

  // Function to check if a date is tomorrow
  const isDateTomorrow = (dateStr) => {
    const date = parseDateFromDDMMYYYY(dateStr)
    if (!date) return false
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    tomorrow.setHours(0, 0, 0, 0)
    return date.getTime() === tomorrow.getTime()
  }

  // Function to check if a date is in the future (from tomorrow onwards)
  const isDateFuture = (dateStr) => {
    const date = parseDateFromDDMMYYYY(dateStr)
    if (!date) return false
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    return date > today
  }

  // Safe access to cell value
  const getCellValue = (row, index) => {
    if (!row || !row.c || index >= row.c.length) return null
    const cell = row.c[index]
    return cell && 'v' in cell ? cell.v : null
  }

  // Parse Google Sheets Date format into a proper date string
  const parseGoogleSheetsDate = (dateStr) => {
    if (!dateStr) return ''

    // Debug log for date parsing
    // console.log(`Parsing date: "${dateStr}" (type: ${typeof dateStr})`);

    if (typeof dateStr === 'string' && dateStr.startsWith('Date(')) {
      // Handle Google Sheets Date(year,month,day) format
      const match = /Date\((\d+),(\d+),(\d+)\)/.exec(dateStr)
      if (match) {
        const year = parseInt(match[1], 10)
        const month = parseInt(match[2], 10) // 0-indexed in Google's format
        const day = parseInt(match[3], 10)

        // Format as DD/MM/YYYY
        const formatted = `${day.toString().padStart(2, '0')}/${(month + 1).toString().padStart(2, '0')}/${year}`;
        // console.log(`Converted Google Sheets date to: ${formatted}`);
        return formatted;
      }
    }

    // If it's already in DD/MM/YYYY format, return as is
    if (typeof dateStr === 'string' && dateStr.match(/^\d{1,2}\/\d{1,2}\/\d{4}$/)) {
      // Normalize to DD/MM/YYYY format
      const parts = dateStr.split('/');
      const day = parts[0].padStart(2, '0');
      const month = parts[1].padStart(2, '0');
      const year = parts[2];
      const normalized = `${day}/${month}/${year}`;
      console.log(`Normalized date to: ${normalized}`);
      return normalized;
    }

    // Handle Date objects
    if (dateStr instanceof Date && !isNaN(dateStr.getTime())) {
      const formatted = formatDateToDDMMYYYY(dateStr);
      // console.log(`Converted Date object to: ${formatted}`);
      return formatted;
    }

    // If we get here, try to parse as a date and format
    try {
      const date = new Date(dateStr)
      if (!isNaN(date.getTime())) {
        const formatted = formatDateToDDMMYYYY(date);
        console.log(`Parsed generic date to: ${formatted}`);
        return formatted;
      }
    } catch (e) {
      console.error("Error parsing date:", e)
    }

    // Return original if parsing fails
    // console.log(`Failed to parse date, returning original: ${dateStr}`);
    return dateStr
  }

  // Modified fetch function to support both checklist and delegation
  const fetchDepartmentData = async () => {
    // For delegation mode, always use "DELEGATION" sheet
    // For checklist mode, use "Checklist" as default sheet
    const sheetName = dashboardType === "delegation" ? "DELEGATION" : "Checklist";

    try {
      // Debug: Log which sheet we're fetching
      // console.log(`Fetching data for dashboard type: ${dashboardType}, sheet: ${sheetName}`);

      const response = await fetch(`https://docs.google.com/spreadsheets/d/101zBKPpsMtmBi36uCULsJoUgj_q7-0m1pjIXY5zmbP8/gviz/tq?tqx=out:json&sheet=${sheetName}`);

      if (!response.ok) {
        throw new Error(`Failed to fetch ${sheetName} sheet data: ${response.status}`);
      }

      const text = await response.text();
      const jsonStart = text.indexOf('{');
      const jsonEnd = text.lastIndexOf('}');
      const jsonString = text.substring(jsonStart, jsonEnd + 1);
      const data = JSON.parse(jsonString);

      // Debug: Log the fetched data structure
      console.log(`Fetched data from ${sheetName}:`, {
        totalRows: data.table.rows.length,
        firstFewRows: data.table.rows.slice(0, 3).map((row, idx) => ({
          rowIndex: idx,
          rowData: row.c ? row.c.map(cell => cell?.v) : row
        }))
      });

      // Get current user details
      const username = sessionStorage.getItem('username');
      const userRole = sessionStorage.getItem('role');

      // Initialize counters
      let totalTasks = 0;
      let completedTasks = 0;
      let pendingTasks = 0;
      let overdueTasks = 0;

      // Add new counters for delegation mode
      let completedRatingOne = 0;
      let completedRatingTwo = 0;
      let completedRatingThreePlus = 0;

      // Monthly data for bar chart
      const monthlyData = {
        Jan: { completed: 0, pending: 0 },
        Feb: { completed: 0, pending: 0 },
        Mar: { completed: 0, pending: 0 },
        Apr: { completed: 0, pending: 0 },
        May: { completed: 0, pending: 0 },
        Jun: { completed: 0, pending: 0 },
        Jul: { completed: 0, pending: 0 },
        Aug: { completed: 0, pending: 0 },
        Sep: { completed: 0, pending: 0 },
        Oct: { completed: 0, pending: 0 },
        Nov: { completed: 0, pending: 0 },
        Dec: { completed: 0, pending: 0 }
      };

      // Status data for pie chart
      const statusData = {
        Completed: 0,
        Pending: 0,
        Overdue: 0
      };

      // Staff tracking map
      const staffTrackingMap = new Map();

      // Get today's date for comparison (only used for checklist mode)
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Get tomorrow's date for comparison (only used for checklist mode)
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);

      // Process row data
      const processedRows = data.table.rows.map((row, rowIndex) => {
        // Skip header row
        if (rowIndex === 0) return null;

        // Debug: Log row processing for first few rows
        if (rowIndex <= 5) {
          // console.log(`Processing row ${rowIndex + 1} (sheet row ${rowIndex + 1}):`, row);
        }

        // For non-admin users, filter by username in Column E (index 4) - "Name"
        const assignedTo = getCellValue(row, 4) || 'Unassigned';
        const isUserMatch = userRole === 'admin' ||
          assignedTo.toLowerCase() === username.toLowerCase();

        // Debug: Log user matching for first few rows
        if (rowIndex <= 5) {
          console.log(`Row ${rowIndex + 1}: assignedTo="${assignedTo}", username="${username}", userRole="${userRole}", isMatch=${isUserMatch}`);
        }

        // If not a match and not admin, skip this row
        if (!isUserMatch) {
          if (rowIndex <= 5) console.log(`Row ${rowIndex + 1}: Skipped due to user mismatch`);
          return null;
        }

        // Check column B for valid task row - "Task ID"
        const taskId = getCellValue(row, 1); // Column B (index 1)

        // Debug: Log task ID for first few rows
        if (rowIndex <= 5) {
          console.log(`Row ${rowIndex + 1}: taskId="${taskId}" (type: ${typeof taskId})`);
        }

        // More lenient validation - allow any non-empty value as task ID
        if (taskId === null || taskId === undefined || taskId === '' ||
          (typeof taskId === 'string' && taskId.trim() === '')) {
          if (rowIndex <= 5) console.log(`Row ${rowIndex + 1}: Skipped due to empty/null task ID`);
          return null;
        }

        // Convert task ID to string for consistency
        const taskIdStr = String(taskId).trim();

        // Get task start date from Column G (index 6) - "Task Start Date"
        let taskStartDateValue = getCellValue(row, 6);
        const taskStartDate = taskStartDateValue ? parseGoogleSheetsDate(String(taskStartDateValue)) : '';

        // Debug: Log task start date for first few rows
        if (rowIndex <= 5) {
          console.log(`Row ${rowIndex + 1}: taskStartDateValue="${taskStartDateValue}", parsed="${taskStartDate}"`);
        }

        // UPDATED: Different date filtering logic for delegation vs checklist
        if (dashboardType === "delegation") {
          // For DELEGATION mode: Process ALL tasks with valid task IDs, no date filtering
          if (!taskId || taskId === null || taskId === undefined || taskId === '' ||
            (typeof taskId === 'string' && taskId.trim() === '')) {
            if (rowIndex <= 5) console.log(`Row ${rowIndex + 1}: Skipped due to invalid task ID in delegation mode`);
            return null;
          }
        } else {
          // For CHECKLIST mode: Keep existing date filtering logic
          const taskStartDateObj = parseDateFromDDMMYYYY(taskStartDate);

          if (rowIndex <= 5) {
            console.log(`Row ${rowIndex + 1}: taskStartDateObj=${taskStartDateObj}, today=${today}, tomorrow=${tomorrow}, isValid=${!!taskStartDateObj}`);
          }

          // Process tasks that have a valid start date and are due up to tomorrow (include tomorrow's tasks)
          if (!taskStartDateObj || taskStartDateObj > tomorrow) {
            if (rowIndex <= 5) console.log(`Row ${rowIndex + 1}: Skipped due to invalid/far future date (beyond tomorrow)`);
            return null; // Skip tasks beyond tomorrow
          }
        }

        // Get completion data based on dashboard type
        let completionDateValue, completionDate;
        if (dashboardType === "delegation") {
          // For delegation: Column L (index 11) - "Actual"
          completionDateValue = getCellValue(row, 11);
        } else {
          // For checklist: Column K (index 10) - "Actual"
          completionDateValue = getCellValue(row, 10);
        }

        completionDate = completionDateValue ? parseGoogleSheetsDate(String(completionDateValue)) : '';

        // Debug: Log completion date for first few rows
        if (rowIndex <= 5) {
          // console.log(`Row ${rowIndex + 1}: completionDateValue="${completionDateValue}", parsed="${completionDate}"`);
        }

        // Track staff details
        if (!staffTrackingMap.has(assignedTo)) {
          staffTrackingMap.set(assignedTo, {
            name: assignedTo,
            totalTasks: 0,
            completedTasks: 0,
            pendingTasks: 0,
            progress: 0
          });
        }

        // Get additional task details
        const taskDescription = getCellValue(row, 5) || 'Untitled Task'; // Column F - "Task Description"
        const frequency = getCellValue(row, 7) || 'one-time'; // Column H - "Freq"
        const department = getCellValue(row, 2) || 'Unassigned';
        console.log('Row dept:', getCellValue(row, 3), 'at row', rowIndex);

        // UPDATED: Determine task status for display purposes - restored overdue logic for delegation
        let status = 'pending';

        if (completionDate && completionDate !== '') {
          status = 'completed';
        } else if (isDateInPast(taskStartDate) && !isDateToday(taskStartDate)) {
          // For both modes: past dates (excluding today) = overdue
          status = 'overdue';
        } else {
          // For both modes: today or future dates = pending
          status = 'pending';
        }

        // Debug: Log status determination for first few rows
        if (rowIndex <= 5) {
          console.log(`Row ${rowIndex + 1}: status="${status}", completionDate="${completionDate}", dashboardType="${dashboardType}"`);
        }

        const taskObj = {
          id: taskIdStr,
          title: taskDescription,
          department: department || 'Unassigned', // ensure it has value
          assignedTo,
          taskStartDate,
          dueDate: taskStartDate,
          status,
          frequency
        };

        if (rowIndex <= 5) {
          console.log(`Row ${rowIndex + 1} - All cells:`, row.c ? row.c.map((cell, idx) => `Col${idx}: ${cell?.v}`) : 'No cells');
        }

        // Update staff member totals
        const staffData = staffTrackingMap.get(assignedTo);
        staffData.totalTasks++;

        // UPDATED: Count for dashboard cards - different logic for delegation vs checklist
        if (dashboardType === "delegation") {
          // For DELEGATION mode: Count ALL valid tasks, no date restrictions
          totalTasks++;

          if (status === 'completed') {
            completedTasks++;
            staffData.completedTasks++;
            statusData.Completed++;

            // For delegation mode, count by rating
            const ratingValue = getCellValue(row, 17); // Column R - "Pending Color Code"
            if (ratingValue === 1) {
              completedRatingOne++;
            } else if (ratingValue === 2) {
              completedRatingTwo++;
            } else if (ratingValue > 2) {
              completedRatingThreePlus++;
            }

            // Update monthly data for completed tasks
            const completedMonth = parseDateFromDDMMYYYY(completionDate);
            if (completedMonth) {
              const monthName = completedMonth.toLocaleString('default', { month: 'short' });
              if (monthlyData[monthName]) {
                monthlyData[monthName].completed++;
              }
            }
          } else {
            // Task is not completed - apply counting logic for both modes
            staffData.pendingTasks++;

            if (isDateInPast(taskStartDate) && !isDateToday(taskStartDate)) {
              // Past dates (excluding today) = overdue
              overdueTasks++;
              statusData.Overdue++;
            }

            // All incomplete tasks (including overdue + today) = pending
            pendingTasks++;
            statusData.Pending++;

            // Update monthly data for pending tasks
            const monthName = (dashboardType === "delegation" ? new Date() : today).toLocaleString('default', { month: 'short' });
            if (monthlyData[monthName]) {
              monthlyData[monthName].pending++;
            }
          }
        } else {
          // For CHECKLIST mode: Keep existing logic with date restrictions
          const taskStartDateObj = parseDateFromDDMMYYYY(taskStartDate);
          const shouldCountInStats = taskStartDateObj <= today;

          if (shouldCountInStats) {
            totalTasks++;

            if (status === 'completed') {
              completedTasks++;
              staffData.completedTasks++;
              statusData.Completed++;

              // Update monthly data for completed tasks
              const completedMonth = parseDateFromDDMMYYYY(completionDate);
              if (completedMonth) {
                const monthName = completedMonth.toLocaleString('default', { month: 'short' });
                if (monthlyData[monthName]) {
                  monthlyData[monthName].completed++;
                }
              }
            } else {
              staffData.pendingTasks++;

              if (isDateInPast(taskStartDate) && !isDateToday(taskStartDate)) {
                // Past dates (excluding today) = overdue
                overdueTasks++;
                statusData.Overdue++;
              }

              // All incomplete tasks (including overdue + today) = pending
              pendingTasks++;
              statusData.Pending++;

              // Update monthly data for pending tasks
              const monthName = today.toLocaleString('default', { month: 'short' });
              if (monthlyData[monthName]) {
                monthlyData[monthName].pending++;
              }
            }
          }
        }

        return taskObj;
      }).filter(task => task !== null);

      // Debug: Log processing summary
      console.log(`Processing summary for ${sheetName}:`);
      console.log(`  Dashboard type: ${dashboardType}`);
      console.log(`  Total rows in sheet: ${data.table.rows.length}`);
      console.log(`  Rows after filtering: ${processedRows.length}`);
      console.log(`  Total tasks counted: ${totalTasks}`);
      console.log(`  Completed tasks: ${completedTasks}`);
      console.log(`  Pending tasks: ${pendingTasks}`);
      console.log(`  Overdue tasks: ${overdueTasks}`);
      console.log(`  Completed Rating 1: ${completedRatingOne}`);
      console.log(`  Completed Rating 2: ${completedRatingTwo}`);
      console.log(`  Completed Rating 3+: ${completedRatingThreePlus}`);

      // Calculate completion rate
      const completionRate = totalTasks > 0 ? ((completedTasks / totalTasks) * 100).toFixed(1) : 0;

      // Convert monthly data to chart format
      const barChartData = Object.entries(monthlyData).map(([name, data]) => ({
        name,
        completed: data.completed,
        pending: data.pending
      }));

      // Convert status data to pie chart format
      const pieChartData = [
        { name: "Completed", value: statusData.Completed, color: "#22c55e" },
        { name: "Pending", value: statusData.Pending, color: "#facc15" },
        { name: "Overdue", value: statusData.Overdue, color: "#ef4444" }
      ];

      // Process staff tracking map
      const staffMembers = Array.from(staffTrackingMap.values()).map(staff => {
        const progress = staff.totalTasks > 0
          ? Math.round((staff.completedTasks / staff.totalTasks) * 100)
          : 0;

        return {
          id: staff.name.replace(/\s+/g, '-').toLowerCase(),
          name: staff.name,
          email: `${staff.name.toLowerCase().replace(/\s+/g, '.')}@example.com`,
          totalTasks: staff.totalTasks,
          completedTasks: staff.completedTasks,
          pendingTasks: staff.pendingTasks,
          progress
        };
      });

      // Update department data state
      setDepartmentData({
        allTasks: processedRows,
        staffMembers,
        totalTasks,
        completedTasks,
        pendingTasks,
        overdueTasks,
        completionRate,
        barChartData,
        pieChartData,
        completedRatingOne,
        completedRatingTwo,
        completedRatingThreePlus
      });

    } catch (error) {
      console.error(`Error fetching ${sheetName} sheet data:`, error);
    }
  };

  useEffect(() => {
    fetchDepartmentData();
  }, [dashboardType]);

  // When dashboard loads, set current date
  useEffect(() => {
    setCurrentDate(new Date());
  }, []);

  // Filter tasks based on the filter criteria
  const filteredTasks = departmentData.allTasks.filter((task) => {
    // Filter by status
    if (filterStatus !== "all" && task.status !== filterStatus) return false;

    // Filter by staff
    if (filterStaff !== "all" && task.assignedTo !== filterStaff) return false;

    // Filter by search query
    if (searchQuery && searchQuery.trim() !== "") {
      const query = searchQuery.toLowerCase().trim();

      if (typeof task.title === 'string' && task.title.toLowerCase().includes(query)) {
        return true;
      }

      if ((typeof task.id === 'string' && task.id.toLowerCase().includes(query)) ||
        (typeof task.id === 'number' && task.id.toString().includes(query))) {
        return true;
      }

      if (typeof task.assignedTo === 'string' && task.assignedTo.toLowerCase().includes(query)) {
        return true;
      }

      return false;
    }

    return true;
  });

  // UPDATED: Get tasks by view with updated delegation logic
  const getTasksByView = (view) => {
    const viewFilteredTasks = filteredTasks.filter((task) => {
      // Skip completed tasks in all views
      if (task.status === "completed") return false;

      // Apply date-based filtering
      const taskStartDate = parseDateFromDDMMYYYY(task.taskStartDate);
      if (!taskStartDate) return false;

      switch (view) {
        case "recent":
          if (dashboardType === "delegation") {
            // For DELEGATION: Show only today's tasks (pending only)
            return isDateToday(task.taskStartDate);
          } else {
            // For CHECKLIST: Show tasks due today (pending only)
            return isDateToday(task.taskStartDate);
          }
        case "upcoming":
          if (dashboardType === "delegation") {
            // For DELEGATION: Show all future tasks (from tomorrow onwards, excluding today)
            return isDateFuture(task.taskStartDate);
          } else {
            // For CHECKLIST: Show tasks due tomorrow only
            return isDateTomorrow(task.taskStartDate);
          }
        case "overdue":
          if (dashboardType === "delegation") {
            // For DELEGATION: Show all past date pending tasks (excluding today)
            return isDateInPast(task.taskStartDate) && !isDateToday(task.taskStartDate);
          } else {
            // For CHECKLIST: Show tasks with start dates in the past (excluding today)
            return isDateInPast(task.taskStartDate) && !isDateToday(task.taskStartDate);
          }
        default:
          return true;
      }
    });

    return viewFilteredTasks;
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "completed":
        return "bg-green-500 hover:bg-green-600 text-white"
      case "pending":
        return "bg-amber-500 hover:bg-amber-600 text-white"
      case "overdue":
        return "bg-red-500 hover:bg-red-600 text-white"
      default:
        return "bg-gray-500 hover:bg-gray-600 text-white"
    }
  }

  const getFrequencyColor = (frequency) => {
    switch (frequency) {
      case "one-time":
        return "bg-gray-500 hover:bg-gray-600 text-white"
      case "daily":
        return "bg-blue-500 hover:bg-blue-600 text-white"
      case "weekly":
        return "bg-purple-500 hover:bg-purple-600 text-white"
      case "fortnightly":
        return "bg-indigo-500 hover:bg-indigo-600 text-white"
      case "monthly":
        return "bg-orange-500 hover:bg-orange-600 text-white"
      case "quarterly":
        return "bg-amber-500 hover:bg-amber-600 text-white"
      case "yearly":
        return "bg-emerald-500 hover:bg-emerald-600 text-white"
      default:
        return "bg-gray-500 hover:bg-gray-600 text-white"
    }
  }

  // Tasks Overview Chart Component
  const TasksOverviewChart = () => {
    return (
      <ResponsiveContainer width="100%" height={350}>
        <BarChart data={departmentData.barChartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis dataKey="name" fontSize={12} stroke="#888888" tickLine={false} axisLine={false} />
          <YAxis fontSize={12} stroke="#888888" tickLine={false} axisLine={false} tickFormatter={(value) => `${value}`} />
          <Tooltip />
          <Legend />
          <Bar dataKey="completed" stackId="a" fill="#22c55e" radius={[4, 4, 0, 0]} />
          <Bar dataKey="pending" stackId="a" fill="#f87171" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    )
  }

  // Tasks Completion Chart Component
  const TasksCompletionChart = () => {
    return (
      <ResponsiveContainer width="100%" height={300}>
        <PieChart>
          <Pie data={departmentData.pieChartData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={2} dataKey="value">
            {departmentData.pieChartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    )
  }

  const StaffTasksTable = () => {
    const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

    useEffect(() => {
      const handleResize = () => {
        setIsMobile(window.innerWidth < 768);
      };

      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
    }, []);

    if (isMobile) {
      return (
        <div className="space-y-4">
          {departmentData.staffMembers.map((staff) => (
            <div key={staff.id} className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm hover:shadow-md transition-shadow">
              {/* Header Row */}
              <div className="flex justify-between items-start mb-4">
                <div>
                  <div className="text-lg font-semibold text-gray-900">{staff.name}</div>
                  <div className="text-sm text-gray-500">{staff.email}</div>
                </div>
                <div className="px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                  {staff.progress >= 80 ? t('dashboard.excellent') : staff.progress >= 60 ? t('dashboard.good') : t('dashboard.needsImprovement')}
                </div>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="text-center p-3 bg-gray-50 rounded-lg">
                  <div className="text-2xl font-bold text-gray-900">{staff.totalTasks}</div>
                  <div className="text-xs text-gray-500 uppercase tracking-wider">{t('dashboard.totalTasks')}</div>
                </div>
                <div className="text-center p-3 bg-blue-50 rounded-lg">
                  <div className="text-2xl font-bold text-blue-600">{staff.completedTasks}</div>
                  <div className="text-xs text-gray-500 uppercase tracking-wider">{t('assignTask.completed')}</div>
                </div>
                <div className="text-center p-3 bg-orange-50 rounded-lg">
                  <div className="text-2xl font-bold text-orange-600">{staff.pendingTasks}</div>
                  <div className="text-xs text-gray-500 uppercase tracking-wider">{t('assignTask.pending')}</div>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <div className="w-full bg-gray-200 rounded-full h-3">
                    <div
                      className="bg-blue-600 h-3 rounded-full transition-all duration-300"
                      style={{ width: `${staff.progress}%` }}
                    />
                  </div>
                </div>
                <span className="font-semibold text-sm text-gray-900 min-w-[50px] text-right">
                  {staff.progress}%
                </span>
              </div>
            </div>
          ))}
        </div>
      );
    }

    // Desktop table view (unchanged)
    return (
      <div className="rounded-md border border-gray-200 overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                {t('table.name')}
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                {t('dashboard.totalTasks')}
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                {t('assignTask.completed')}
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                {t('assignTask.pending')}
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                {t('table.progress')}
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                {t('table.status')}
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {departmentData.staffMembers.map((staff) => (
              <tr key={staff.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div>
                    <div className="text-sm font-medium text-gray-900">{staff.name}</div>
                    <div className="text-xs text-gray-500">{staff.email}</div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{staff.totalTasks}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{staff.completedTasks}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{staff.pendingTasks}</td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center gap-2">
                    <div className="w-[100px] bg-gray-200 rounded-full h-2">
                      <div className="bg-blue-600 h-2 rounded-full" style={{ width: `${staff.progress}%` }} />
                    </div>
                    <span className="text-xs text-gray-500">{staff.progress}%</span>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {staff.progress >= 80 ? (
                    <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                      {t('dashboard.excellent')}
                    </span>
                  ) : staff.progress >= 60 ? (
                    <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-yellow-100 text-yellow-800">
                      {t('dashboard.good')}
                    </span>
                  ) : (
                    <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800">
                      {t('dashboard.needsImprovement')}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <h1 className="text-2xl font-bold tracking-tight text-purple-500">{t('dashboard.title')}</h1>
          <div className="flex items-center gap-2">
            {/* Dashboard Type Selection */}
            <select
              value={dashboardType}
              onChange={(e) => {
                setDashboardType(e.target.value);
              }}
              className="w-[140px] rounded-md border border-purple-200 p-2 focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
            >
              <option value="checklist">Checklist</option>
              <option value="delegation">Delegation</option>
            </select>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <div onClick={() => handleCardClick("total")} className="cursor-pointer rounded-lg border border-l-4 border-l-blue-500 shadow-md hover:shadow-lg transition-all bg-white">
            <div className="flex flex-row items-center justify-between space-y-0 pb-2 bg-gradient-to-r from-blue-50 to-blue-100 rounded-tr-lg p-4">
              <h3 className="text-sm font-medium text-blue-700">{t('dashboard.totalTasks')}</h3>
              <ListTodo className="h-4 w-4 text-blue-500" />
            </div>
            <div className="p-4">
              <div className="text-3xl font-bold text-blue-700">{departmentData.totalTasks}</div>
              <p className="text-xs text-blue-600">{t('dashboard.totalTasksDescription')}</p>
            </div>
          </div>

          <div onClick={() => handleCardClick("completed")} className="cursor-pointer rounded-lg border border-l-4 border-l-green-500 shadow-md hover:shadow-lg transition-all bg-white">
            <div className="flex flex-row items-center justify-between space-y-0 pb-2 bg-gradient-to-r from-green-50 to-green-100 rounded-tr-lg p-4">
              <h3 className="text-sm font-medium text-green-700">{t('dashboard.completedTasks')}</h3>
              <CheckCircle2 className="h-4 w-4 text-green-500" />
            </div>
            <div className="p-4">
              <div className="text-3xl font-bold text-green-700">{departmentData.completedTasks}</div>
              <p className="text-xs text-green-600">{t('common.success')}</p>
            </div>
          </div>

          <div onClick={() => handleCardClick("pending")} className="cursor-pointer rounded-lg border border-l-4 border-l-amber-500 shadow-md hover:shadow-lg transition-all bg-white">
            <div className="flex flex-row items-center justify-between space-y-0 pb-2 bg-gradient-to-r from-amber-50 to-amber-100 rounded-tr-lg p-4">
              <h3 className="text-sm font-medium text-amber-700">{t('dashboard.pendingTasks')}</h3>
              <Clock className="h-4 w-4 text-amber-500" />
            </div>
            <div className="p-4">
              <div className="text-3xl font-bold text-amber-700">{departmentData.pendingTasks}</div>
              <p className="text-xs text-amber-600">{t('assignTask.pending')}</p>
            </div>
          </div>

          <div onClick={() => handleCardClick("overdue")} className="cursor-pointer rounded-lg border border-l-4 border-l-red-500 shadow-md hover:shadow-lg transition-all bg-white">
            <div className="flex flex-row items-center justify-between space-y-0 pb-2 bg-gradient-to-r from-red-50 to-red-100 rounded-tr-lg p-4">
              <h3 className="text-sm font-medium text-red-700">{t('dashboard.overdueTasks')}</h3>
              <AlertTriangle className="h-4 w-4 text-red-500" />
            </div>
            <div className="p-4">
              <div className="text-3xl font-bold text-red-700">{departmentData.overdueTasks}</div>
              <p className="text-xs text-red-600">{t('common.error')}</p>
            </div>
          </div>
        </div>


        {/* Task Navigation Tabs - Restored to 3 tabs for both modes */}
        <div className="w-full overflow-hidden rounded-lg border border-gray-200 bg-white">
          <div className="grid grid-cols-3">
            <button
              className={`py-3 text-center font-medium transition-colors ${taskView === "recent" ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              onClick={() => setTaskView("recent")}
            >
              {dashboardType === "delegation" ? t('calendar.today') : t('dashboard.recentActivity')}
            </button>
            <button
              className={`py-3 text-center font-medium transition-colors ${taskView === "upcoming" ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              onClick={() => setTaskView("upcoming")}
            >
              {dashboardType === "delegation" ? t('calendar.agenda') : t('calendar.agenda')}
            </button>
            <button
              className={`py-3 text-center font-medium transition-colors ${taskView === "overdue" ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              onClick={() => setTaskView("overdue")}
            >
              {t('dashboard.overdueTasks')}
            </button>
          </div>

          <div className="p-4">
            <div className="flex flex-col gap-4 md:flex-row mb-4">
              <div className="flex-1 space-y-2">
                <label htmlFor="search" className="flex items-center text-purple-700">
                  <Filter className="h-4 w-4 mr-2" />
                  {t('common.search')}
                </label>
                <input
                  id="search"
                  placeholder={t('dataPage.searchPlaceholder')}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full rounded-md border border-purple-200 p-2 focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
                />
              </div>
              <div className="space-y-2 md:w-[180px]">
                <label htmlFor="staff-filter" className="flex items-center text-purple-700">
                  <Filter className="h-4 w-4 mr-2" />
                  {t('dataPage.filterBy')}
                </label>
                <select
                  id="staff-filter"
                  value={filterStaff}
                  onChange={(e) => setFilterStaff(e.target.value)}
                  className="w-full rounded-md border border-purple-200 p-2 focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
                >
                  <option value="all">{t('calendar.allNames')}</option>
                  {departmentData.staffMembers.map((staff) => (
                    <option key={staff.id} value={staff.name}>
                      {staff.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {getTasksByView(taskView).length === 0 ? (
              <div className="text-center p-8 text-gray-500">
                <p>{t('common.noTasksFound')}</p>
              </div>
            ) : (
              <>
                {/* Mobile: cards */}
                <div className="grid grid-cols-1 gap-3 md:hidden" style={{ maxHeight: "400px", overflowY: "auto" }}>
                  {getTasksByView(taskView).map((task) => (
                    <div
                      key={task.id}
                      className="border border-gray-200 rounded-lg p-3 bg-white shadow-sm"
                    >
                      {/* Top row: ID + frequency pill */}
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-semibold text-gray-500">
                          #{task.id}
                        </span>
                        <span
                          className={`px-2 py-1 rounded-full text-[11px] font-medium ${getFrequencyColor(
                            task.frequency
                          )}`}
                        >
                          {task.frequency.charAt(0).toUpperCase() + task.frequency.slice(1)}
                        </span>
                      </div>

                      {/* Title / description */}
                      <p className="text-sm font-medium text-gray-900 mb-2">
                        {task.title}
                      </p>

                      {/* Meta info */}
                      <div className="space-y-1 text-xs text-gray-600">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-gray-700">{t('assignTask.assignTo')}:</span>
                          <span>{task.assignedTo}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-gray-700">{t('assignTask.startDate')}:</span>
                          <span>{task.taskStartDate}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Desktop: table */}
                <div className="hidden md:block overflow-x-auto" style={{ maxHeight: "400px", overflowY: "auto" }}>
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50 sticky top-0 z-10">
                      <tr>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          {t('table.taskId')}
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          {t('table.description')}
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          {t('table.assignedTo')}
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          {t('table.taskStartDate')}
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          {t('table.frequency')}
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {getTasksByView(taskView).map((task) => (
                        <tr key={task.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {task.id}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {task.title}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {task.assignedTo}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {task.taskStartDate}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span
                              className={`px-2 py-1 rounded-full text-xs font-medium ${getFrequencyColor(
                                task.frequency
                              )}`}
                            >
                              {task.frequency === 'one-time' ? t('assignTask.oneTime') :
                                task.frequency === 'daily' ? t('assignTask.daily') :
                                  task.frequency === 'weekly' ? t('assignTask.weekly') :
                                    task.frequency === 'monthly' ? t('assignTask.monthly') :
                                      task.frequency}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}

          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-1 lg:grid-cols-1">
          <div className="rounded-lg border border-l-4 border-l-indigo-500 shadow-md hover:shadow-lg transition-all bg-white">
            <div className="flex flex-row items-center justify-between space-y-0 pb-2 bg-gradient-to-r from-indigo-50 to-indigo-100 rounded-tr-lg p-4">
              <h3 className="text-sm font-medium text-indigo-700">{t('dashboard.taskCompletionRate')}</h3>
              <BarChart3 className="h-4 w-4 text-indigo-500" />
            </div>
            <div className="p-4">
              <div className="flex items-center justify-between">
                <div className="text-3xl font-bold text-indigo-700">{departmentData.completionRate}%</div>
                <div className="flex items-center space-x-2">
                  <span className="inline-block w-3 h-3 bg-green-500 rounded-full"></span>
                  <span className="text-xs text-gray-600">Completed: {departmentData.completedTasks}</span>
                  <span className="inline-block w-3 h-3 bg-amber-500 rounded-full"></span>
                  <span className="text-xs text-gray-600">Total: {departmentData.totalTasks}</span>
                </div>
              </div>
              <div className="w-full h-2 bg-gray-200 rounded-full mt-2">
                <div
                  className="h-full bg-gradient-to-r from-green-500 to-amber-500 rounded-full"
                  style={{ width: `${departmentData.completionRate}%` }}
                ></div>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="space-y-4">
          <div className="bg-purple-100 rounded-md p-1 flex space-x-1">
            <button
              onClick={() => setActiveTab("overview")}
              className={`flex-1 py-2 text-center rounded-md transition-colors ${activeTab === "overview" ? "bg-purple-600 text-white" : "text-purple-700 hover:bg-purple-200"
                }`}
            >
              {t('dashboard.overview')}
            </button>
            <button
              onClick={() => setActiveTab("mis")}
              className={`flex-1 py-2 text-center rounded-md transition-colors ${activeTab === "mis" ? "bg-purple-600 text-white" : "text-purple-700 hover:bg-purple-200"
                }`}
            >
              {t('dashboard.misReport')}
            </button>
            <button
              onClick={() => setActiveTab("staff")}
              className={`flex-1 py-2 text-center rounded-md transition-colors ${activeTab === "staff" ? "bg-purple-600 text-white" : "text-purple-700 hover:bg-purple-200"
                }`}
            >
              {t('dashboard.staffPerformance')}
            </button>
          </div>

          {activeTab === "overview" && (
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
                <div className="lg:col-span-4 rounded-lg border border-purple-200 shadow-md bg-white">
                  <div className="bg-gradient-to-r from-purple-50 to-pink-50 border-b border-purple-100 p-4">
                    <h3 className="text-purple-700 font-medium">{t('dashboard.tasksOverview')}</h3>
                    <p className="text-purple-600 text-sm">{t('dashboard.completionRateTime')}</p>
                  </div>
                  <div className="p-4 pl-2">
                    <TasksOverviewChart />
                  </div>
                </div>
                <div className="lg:col-span-3 rounded-lg border border-purple-200 shadow-md bg-white">
                  <div className="bg-gradient-to-r from-purple-50 to-pink-50 border-b border-purple-100 p-4">
                    <h3 className="text-purple-700 font-medium">{t('dashboard.taskStatus')}</h3>
                    <p className="text-purple-600 text-sm">{t('dashboard.statusDistribution')}</p>
                  </div>
                  <div className="p-4">
                    <TasksCompletionChart />
                  </div>
                </div>
              </div>
              <div className="rounded-lg border border-purple-200 shadow-md bg-white">
                <div className="bg-gradient-to-r from-purple-50 to-pink-50 border-b border-purple-100 p-4">
                  <h3 className="text-lg font-semibold text-purple-800">{t('dashboard.staffTaskSummary')}</h3>
                  <p className="text-purple-600 text-sm mt-1">{t('dashboard.staffTaskDescription')}</p>
                </div>
                <div className="p-4">
                  <StaffTasksTable />
                </div>
              </div>

            </div>
          )}

          {/* UPDATED: Modified MIS Report section for delegation mode */}
          {activeTab === "mis" && (
            <div className="rounded-lg border border-purple-200 shadow-md bg-white">
              <div className="bg-gradient-to-r from-purple-50 to-pink-50 border-b border-purple-100 p-4">
                <h3 className="text-purple-700 font-medium">{t('dashboard.misReport')}</h3>
                <p className="text-purple-600 text-sm">
                  {dashboardType === "delegation"
                    ? t('dashboard.delegationAnalyticsDescription')
                    : t('dashboard.taskAnalyticsDescription')
                  }
                </p>
              </div>
              <div className="p-4">
                <div className="space-y-8">
                  {/* UPDATED: Only show date range selection for checklist mode */}
                  {dashboardType !== "delegation" && (
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 bg-gray-50 p-4 rounded-lg border border-gray-100">
                      <div className="space-y-2 lg:col-span-1">
                        <label htmlFor="start-date" className="flex items-center text-purple-700 text-sm font-medium">
                          {t('assignTask.startDate')}
                        </label>
                        <input
                          id="start-date"
                          type="date"
                          value={dateRange.startDate}
                          onChange={(e) => setDateRange(prev => ({ ...prev, startDate: e.target.value }))}
                          className="w-full rounded-md border border-purple-200 p-2 focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
                        />
                      </div>
                      <div className="space-y-2 lg:col-span-1">
                        <label htmlFor="end-date" className="flex items-center text-purple-700 text-sm font-medium">
                          {t('assignTask.endDate')}
                        </label>
                        <input
                          id="end-date"
                          type="date"
                          value={dateRange.endDate}
                          onChange={(e) => setDateRange(prev => ({ ...prev, endDate: e.target.value }))}
                          className="w-full rounded-md border border-purple-200 p-2 focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
                        />
                      </div>
                      <div className="space-y-2 lg:col-span-2 flex items-end">
                        <button
                          onClick={filterTasksByDateRange}
                          className="w-full bg-purple-600 hover:bg-purple-700 text-white py-2 px-4 rounded transition-colors"
                        >
                          {t('dashboard.applyFilter')}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* UPDATED: Overall stats with different displays for delegation vs checklist */}
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    <div className="space-y-2">
                      <div className="text-sm font-medium text-purple-600">{t('dashboard.totalTasksAssigned')}</div>
                      <div className="text-3xl font-bold text-purple-700">
                        {dashboardType === "delegation"
                          ? departmentData.totalTasks
                          : (dateRange.filtered ? filteredDateStats.totalTasks : departmentData.totalTasks)
                        }
                      </div>
                      {dashboardType === "delegation" ? (
                        <p className="text-xs text-purple-600">{t('dashboard.delegationSheetDescription')}</p>
                      ) : (
                        dateRange.filtered && (
                          <p className="text-xs text-purple-600">
                            {t('dashboard.forPeriod')}: {formatLocalDate(dateRange.startDate)} - {formatLocalDate(dateRange.endDate)}
                          </p>
                        )
                      )}
                    </div>
                    <div className="space-y-2">
                      <div className="text-sm font-medium text-purple-600">{t('dashboard.tasksCompleted')}</div>
                      <div className="text-3xl font-bold text-purple-700">
                        {dashboardType === "delegation"
                          ? departmentData.completedTasks
                          : (dateRange.filtered ? filteredDateStats.completedTasks : departmentData.completedTasks)
                        }
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="text-sm font-medium text-purple-600">
                        {dashboardType === "delegation" ? "Tasks Pending" : "Tasks Pending/Overdue"}
                      </div>
                      <div className="text-3xl font-bold text-purple-700">
                        {dashboardType === "delegation"
                          ? departmentData.pendingTasks
                          : (dateRange.filtered
                            ? `${filteredDateStats.pendingTasks} / ${filteredDateStats.overdueTasks}`
                            : `${departmentData.pendingTasks} / ${departmentData.overdueTasks}`
                          )
                        }
                      </div>
                      <div className="text-xs text-purple-600">
                        {dashboardType === "delegation"
                          ? "All incomplete tasks"
                          : "Pending (all incomplete) / Overdue (past dates only)"
                        }
                      </div>
                    </div>
                  </div>

                  {/* UPDATED: Additional breakdown - only for checklist with date filtering */}
                  {dashboardType !== "delegation" && dateRange.filtered && (
                    <div className="rounded-lg border border-purple-100 p-4 bg-gray-50">
                      <h4 className="text-lg font-medium text-purple-700 mb-4">Detailed Date Range Breakdown</h4>
                      <div className="grid gap-4 md:grid-cols-3">
                        <div className="bg-white p-3 rounded-lg border border-amber-200">
                          <div className="text-sm font-medium text-amber-700">Pending Tasks</div>
                          <div className="text-2xl font-bold text-amber-600">{filteredDateStats.pendingTasks}</div>
                          <div className="text-xs text-amber-600 mt-1">All incomplete tasks (including overdue + today)</div>
                        </div>
                        <div className="bg-white p-3 rounded-lg border border-red-200">
                          <div className="text-sm font-medium text-red-700">Overdue Tasks</div>
                          <div className="text-2xl font-bold text-red-600">{filteredDateStats.overdueTasks}</div>
                          <div className="text-xs text-red-600 mt-1">Past due dates only (excluding today)</div>
                        </div>
                        <div className="bg-white p-3 rounded-lg border border-green-200">
                          <div className="text-sm font-medium text-green-700">Completed Once</div>
                          <div className="text-2xl font-bold text-green-600">{departmentData.completedRatingOne}</div>
                          <div className="text-xs text-green-600 mt-1">Tasks with rating 1</div>
                        </div>
                        <div className="bg-white p-3 rounded-lg border border-amber-200">
                          <div className="text-sm font-medium text-amber-700">Completed Twice</div>
                          <div className="text-2xl font-bold text-amber-600">{departmentData.completedRatingTwo}</div>
                          <div className="text-xs text-amber-600 mt-1">Tasks with rating 2</div>
                        </div>
                        <div className="bg-white p-3 rounded-lg border border-red-200">
                          <div className="text-sm font-medium text-red-700">Completed 3+ Times</div>
                          <div className="text-2xl font-bold text-red-600">{departmentData.completedRatingThreePlus}</div>
                          <div className="text-xs text-red-600 mt-1">Tasks with rating 3 or higher</div>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="space-y-4">
                    <h3 className="text-lg font-medium text-purple-700">Department Performance</h3>
                    <div className="grid gap-4 md:grid-cols-1">
                      <div className="rounded-lg border border-purple-200 bg-white p-4">
                        <h4 className="text-sm font-medium text-purple-700 mb-2">Completion Rate</h4>
                        <div className="flex items-center gap-4">
                          <div className="text-2xl font-bold text-purple-700">
                            {dashboardType === "delegation"
                              ? departmentData.completionRate
                              : (dateRange.filtered ? filteredDateStats.completionRate : departmentData.completionRate)
                            }%
                          </div>
                          <div className="flex-1">
                            <div className="w-full h-6 bg-gray-200 rounded-full">
                              <div
                                className="h-full rounded-full flex items-center justify-end px-3 text-xs font-medium text-white"
                                style={{
                                  width: `${dashboardType === "delegation"
                                    ? departmentData.completionRate
                                    : (dateRange.filtered ? filteredDateStats.completionRate : departmentData.completionRate)
                                    }%`,
                                  background: `linear-gradient(to right, #10b981 ${(dashboardType === "delegation"
                                    ? departmentData.completionRate
                                    : (dateRange.filtered ? filteredDateStats.completionRate : departmentData.completionRate)
                                  ) * 0.8}%, #f59e0b ${(dashboardType === "delegation"
                                    ? departmentData.completionRate
                                    : (dateRange.filtered ? filteredDateStats.completionRate : departmentData.completionRate)
                                  ) * 0.8}%)`
                                }}
                              >
                                {dashboardType === "delegation"
                                  ? departmentData.completionRate
                                  : (dateRange.filtered ? filteredDateStats.completionRate : departmentData.completionRate)
                                }%
                              </div>
                            </div>
                          </div>
                        </div>
                        <p className="text-xs text-purple-600 mt-2">
                          {dashboardType === "delegation" ?
                            `${departmentData.completedTasks} of ${departmentData.totalTasks} tasks completed in delegation mode (all sheet data)` :
                            `${dateRange.filtered ? filteredDateStats.completedTasks : departmentData.completedTasks} of ${dateRange.filtered ? filteredDateStats.totalTasks : departmentData.totalTasks} tasks completed in checklist mode`
                          }
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === "staff" && (
            <div className="rounded-lg border border-purple-200 shadow-md bg-white">
              <div className="bg-gradient-to-r from-purple-50 to-pink-50 border-b border-purple-100 p-4">
                <h3 className="text-purple-700 font-medium">Staff Performance</h3>
                <p className="text-purple-600 text-sm">
                  {dashboardType === "delegation"
                    ? "Task completion rates by staff member (all delegation sheet data)"
                    : "Task completion rates by staff member (tasks up to today only)"
                  }
                </p>
              </div>
              <div className="p-4">
                <div className="space-y-8">
                  {departmentData.staffMembers.length > 0 ? (
                    <>
                      {(() => {
                        // Sort staff members by performance (high to low)
                        const sortedStaffMembers = [...departmentData.staffMembers]
                          .filter(staff => staff.totalTasks > 0)
                          .sort((a, b) => b.progress - a.progress);

                        return (
                          <>
                            {/* High performers section (70% or above) */}
                            <div className="rounded-md border border-green-200">
                              <div className="p-4 bg-gradient-to-r from-green-50 to-green-100 border-b border-green-200">
                                <h3 className="text-lg font-medium text-green-700">Top Performers</h3>
                                <p className="text-sm text-green-600">
                                  {dashboardType === "delegation"
                                    ? "Staff with high task completion rates (all delegation data)"
                                    : "Staff with high task completion rates (tasks up to today only)"
                                  }
                                </p>
                              </div>
                              <div className="p-4">
                                <div className="space-y-4">
                                  {sortedStaffMembers
                                    .filter(staff => staff.progress >= 70)
                                    .map((staff) => (
                                      <div
                                        key={staff.id}
                                        className="flex items-center justify-between p-3 border border-green-100 rounded-md bg-green-50"
                                      >
                                        <div className="flex items-center gap-2">
                                          <div className="h-10 w-10 rounded-full bg-gradient-to-r from-green-500 to-teal-500 flex items-center justify-center">
                                            <span className="text-sm font-medium text-white">{staff.name.charAt(0)}</span>
                                          </div>
                                          <div>
                                            <p className="font-medium text-green-700">{staff.name}</p>
                                            <p className="text-xs text-green-600">{staff.completedTasks} of {staff.totalTasks} tasks completed</p>
                                          </div>
                                        </div>
                                        <div className="text-lg font-bold text-green-600">{staff.progress}%</div>
                                      </div>
                                    ))
                                  }
                                  {sortedStaffMembers.filter(staff => staff.progress >= 70).length === 0 && (
                                    <div className="text-center p-4 text-gray-500">
                                      <p>No staff members with high completion rates found.</p>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Mid performers section (40-69%) */}
                            <div className="rounded-md border border-yellow-200">
                              <div className="p-4 bg-gradient-to-r from-yellow-50 to-yellow-100 border-b border-yellow-200">
                                <h3 className="text-lg font-medium text-yellow-700">Average Performers</h3>
                                <p className="text-sm text-yellow-600">
                                  {dashboardType === "delegation"
                                    ? "Staff with moderate task completion rates (all delegation data)"
                                    : "Staff with moderate task completion rates (tasks up to today only)"
                                  }
                                </p>
                              </div>
                              <div className="p-4">
                                <div className="space-y-4">
                                  {sortedStaffMembers
                                    .filter(staff => staff.progress >= 40 && staff.progress < 70)
                                    .map((staff) => (
                                      <div
                                        key={staff.id}
                                        className="flex items-center justify-between p-3 border border-yellow-100 rounded-md bg-yellow-50"
                                      >
                                        <div className="flex items-center gap-2">
                                          <div className="h-10 w-10 rounded-full bg-gradient-to-r from-yellow-500 to-amber-500 flex items-center justify-center">
                                            <span className="text-sm font-medium text-white">{staff.name.charAt(0)}</span>
                                          </div>
                                          <div>
                                            <p className="font-medium text-yellow-700">{staff.name}</p>
                                            <p className="text-xs text-yellow-600">{staff.completedTasks} of {staff.totalTasks} tasks completed</p>
                                          </div>
                                        </div>
                                        <div className="text-lg font-bold text-yellow-600">{staff.progress}%</div>
                                      </div>
                                    ))
                                  }
                                  {sortedStaffMembers.filter(staff => staff.progress >= 40 && staff.progress < 70).length === 0 && (
                                    <div className="text-center p-4 text-gray-500">
                                      <p>No staff members with moderate completion rates found.</p>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Low performers section (below 40%) */}
                            <div className="rounded-md border border-red-200">
                              <div className="p-4 bg-gradient-to-r from-red-50 to-red-100 border-b border-red-200">
                                <h3 className="text-lg font-medium text-red-700">Needs Improvement</h3>
                                <p className="text-sm text-red-600">
                                  {dashboardType === "delegation"
                                    ? "Staff with lower task completion rates (all delegation data)"
                                    : "Staff with lower task completion rates (tasks up to today only)"
                                  }
                                </p>
                              </div>
                              <div className="p-4">
                                <div className="space-y-4">
                                  {sortedStaffMembers
                                    .filter(staff => staff.progress < 40)
                                    .map((staff) => (
                                      <div
                                        key={staff.id}
                                        className="flex items-center justify-between p-3 border border-red-100 rounded-md bg-red-50"
                                      >
                                        <div className="flex items-center gap-2">
                                          <div className="h-10 w-10 rounded-full bg-gradient-to-r from-red-500 to-pink-500 flex items-center justify-center">
                                            <span className="text-sm font-medium text-white">{staff.name.charAt(0)}</span>
                                          </div>
                                          <div>
                                            <p className="font-medium text-red-700">{staff.name}</p>
                                            <p className="text-xs text-red-600">{staff.completedTasks} of {staff.totalTasks} tasks completed</p>
                                          </div>
                                        </div>
                                        <div className="text-lg font-bold text-red-600">{staff.progress}%</div>
                                      </div>
                                    ))
                                  }
                                  {sortedStaffMembers.filter(staff => staff.progress < 40).length === 0 && (
                                    <div className="text-center p-4 text-gray-500">
                                      <p>No staff members with low completion rates found.</p>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* No assigned tasks section */}
                            {departmentData.staffMembers.filter(staff => staff.totalTasks === 0).length > 0 && (
                              <div className="rounded-md border border-gray-200">
                                <div className="p-4 bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-200">
                                  <h3 className="text-lg font-medium text-gray-700">No Tasks Assigned</h3>
                                  <p className="text-sm text-gray-600">
                                    {dashboardType === "delegation"
                                      ? "Staff with no tasks in delegation sheet"
                                      : "Staff with no tasks assigned for current period"
                                    }
                                  </p>
                                </div>
                                <div className="p-4">
                                  <div className="space-y-4">
                                    {departmentData.staffMembers
                                      .filter(staff => staff.totalTasks === 0)
                                      .map((staff) => (
                                        <div
                                          key={staff.id}
                                          className="flex items-center justify-between p-3 border border-gray-100 rounded-md bg-gray-50"
                                        >
                                          <div className="flex items-center gap-2">
                                            <div className="h-10 w-10 rounded-full bg-gradient-to-r from-gray-500 to-gray-600 flex items-center justify-center">
                                              <span className="text-sm font-medium text-white">{staff.name.charAt(0)}</span>
                                            </div>
                                            <div>
                                              <p className="font-medium text-gray-700">{staff.name}</p>
                                              <p className="text-xs text-gray-600">
                                                {dashboardType === "delegation"
                                                  ? "No tasks in delegation sheet"
                                                  : "No tasks assigned up to today"
                                                }
                                              </p>
                                            </div>
                                          </div>
                                          <div className="text-lg font-bold text-gray-600">N/A</div>
                                        </div>
                                      ))
                                    }
                                  </div>
                                </div>
                              </div>
                            )}
                          </>
                        );
                      })()}
                    </>
                  ) : (
                    <div className="text-center p-8 text-gray-500">
                      <p>
                        {dashboardType === "delegation"
                          ? "No delegation data available."
                          : "Loading staff data..."
                        }
                      </p>
                    </div>
                  )}

                </div>

              </div>

            </div>

          )}
        </div>
        {/* Popup Modal */}
        {popupOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl h-[90vh] flex flex-col overflow-auto">
              {/* Header */}
              <div className="flex justify-between items-center p-4 border-b">
                <h2 className="text-xl font-bold text-purple-700">
                  {popupType.charAt(0).toUpperCase() + popupType.slice(1)} Tasks Details
                </h2>
                <button onClick={() => setPopupOpen(false)} className="text-gray-500 hover:text-gray-700">
                  <X className="h-6 w-6" />
                </button>
              </div>

              {/* FILTERS */}
              <div className="p-4 border-b bg-gray-50 flex flex-wrap gap-4 items-center">
                {/* Search */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 size-5" />
                  <input
                    type="text"
                    placeholder="Search tasks..."
                    value={popupFilters.search}
                    onChange={e => handlePopupFilterChange("search", e.target.value)}
                    className="pl-10 pr-4 py-2 border border-purple-200 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
                {/* Department Filter */}
                <select
                  value={popupFilters.department}
                  onChange={e => handlePopupFilterChange("department", e.target.value)}
                  className="border border-purple-200 rounded-md p-2 focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value="all">All Departments</option>
                  {Array.from(new Set(popupData.map(task => task.department).filter(Boolean))).map((dept, i) => (
                    <option key={i} value={dept}>{dept}</option>
                  ))}
                </select>
                {/* Name Filter */}
                <select
                  value={popupFilters.name}
                  onChange={e => handlePopupFilterChange("name", e.target.value)}
                  className="border border-purple-200 rounded-md p-2 focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value="all">All Names</option>
                  {Array.from(new Set(popupData.map(task => task.assignedTo).filter(Boolean))).map((name, i) => (
                    <option key={i} value={name}>{name}</option>
                  ))}
                </select>
                {/* Clear Filters */}
                <button
                  onClick={() => setPopupFilters({ search: '', department: 'all', givenBy: 'all', name: 'all' })}
                  className="px-4 py-2 bg-purple-100 text-purple-700 rounded-md hover:bg-purple-200 transition-colors font-medium flex items-center gap-2"
                >
                  <X size={16} /> Clear Filters
                </button>
                <span className="font-medium text-blue-800 ml-auto">
                  Total Tasks {getFilteredPopupData().length}
                </span>
              </div>

              {/* --- TABLE (Desktop), CARD(Mobile) --- */}
              <div className="flex-1 overflow-auto">
                {/* Table: Desktop */}
                <div className="hidden md:block">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50 sticky top-0">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Task ID</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Department</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Start Date</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {getFilteredPopupData().map(task => (
                        <tr key={task.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 text-sm text-gray-900">{task.id}</td>
                          <td className="px-6 py-4 text-sm text-gray-500">{task.department}</td>
                          <td className="px-6 py-4 text-sm text-gray-500">{task.assignedTo}</td>
                          <td className="px-6 py-4 text-sm text-gray-500">{task.title}</td>
                          <td className="px-6 py-4 text-sm text-gray-500">{task.taskStartDate}</td>
                          <td className="px-6 py-4 text-sm">
                            <span className={
                              task.status === "completed" ? "bg-green-500 text-white px-2 py-1 rounded-full" :
                                task.status === "pending" ? "bg-amber-500 text-white px-2 py-1 rounded-full" :
                                  "bg-red-500 text-white px-2 py-1 rounded-full"
                            }>
                              {task.status.charAt(0).toUpperCase() + task.status.slice(1)}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {/* Cards: Mobile */}
                <div className="md:hidden space-y-4 p-4">
                  {getFilteredPopupData().map(task => (
                    <div key={task.id} className="bg-white border border-gray-200 rounded-lg shadow-sm p-4 space-y-3">
                      <div className="flex justify-between">
                        <span className="text-xs font-medium text-gray-500">Task ID</span>
                        <span className="text-sm font-semibold text-gray-900">{task.id}</span>
                      </div>
                      <div>
                        <span className="text-xs font-medium text-gray-500">Description</span>
                        <p className="text-sm text-gray-900">{task.title}</p>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <span className="text-xs font-medium text-gray-500">Department</span>
                          <p className="text-sm text-gray-900">{task.department}</p>
                        </div>
                        <div>
                          <span className="text-xs font-medium text-gray-500">Assigned To</span>
                          <p className="text-sm text-gray-900">{task.assignedTo}</p>
                        </div>
                      </div>
                      <div>
                        <span className="text-xs font-medium text-gray-500">Start Date</span>
                        <p className="text-sm text-gray-900">{task.taskStartDate}</p>
                      </div>
                      <div>
                        <span className={
                          task.status === "completed" ? "bg-green-500 text-white px-2 py-1 rounded-full" :
                            task.status === "pending" ? "bg-amber-500 text-white px-2 py-1 rounded-full" :
                              "bg-red-500 text-white px-2 py-1 rounded-full"
                        }>
                          {task.status.charAt(0).toUpperCase() + task.status.slice(1)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

      </div>
    </AdminLayout>
  )
}