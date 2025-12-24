//Checklist Tasks Page
"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  CheckCircle2,
  Upload,
  X,
  Search,
  History,
  ArrowLeft,
  Camera,
} from "lucide-react";
import AdminLayout from "../../components/layout/AdminLayout";
import { useTranslation } from "../../contexts/TranslationContext";

// Configuration object - Move all configurations here
const CONFIG = {
  // Google Apps Script URL
  APPS_SCRIPT_URL:
    "https://script.google.com/macros/s/AKfycbxR-N0y9pSElWscysbstP48Y8PDQ4-8mnFO_KkbDNP3nLt0rOsxcHa7jtqmKHuJRj6vdw/exec",

  // Google Drive folder ID for file uploads
  DRIVE_FOLDER_ID: "1uUZHLE3sQYMHR-8uT6ARmndrhRjy3-yK",

  // Sheet name to work with
  SHEET_NAME: "Checklist",

  // Page configuration
  PAGE_CONFIG: {
    title: "assignTask.checklistTasks",
    historyTitle: "assignTask.checklistHistory",
    description: "assignTask.checklistDescription",
    historyDescription: "assignTask.checklistHistoryDescription",
  },
};

function AccountDataPage() {
  const { t } = useTranslation();
  const [accountData, setAccountData] = useState([]);
  const [selectedItems, setSelectedItems] = useState(new Set()); // Changed to Set for better performance
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [additionalData, setAdditionalData] = useState({});
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [remarksData, setRemarksData] = useState({});
  const [historyData, setHistoryData] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const [membersList, setMembersList] = useState([]);
  const [selectedMembers, setSelectedMembers] = useState([]);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [userRole, setUserRole] = useState("");
  const [username, setUsername] = useState("");

  const [selectedHistoryItems, setSelectedHistoryItems] = useState(new Set());
  const [isSubmittingHistory, setIsSubmittingHistory] = useState(false);
  // Add this state at the top with other useState declarations
  const [currentCaptureId, setCurrentCaptureId] = useState(null);
  const [isCameraLoading, setIsCameraLoading] = useState(false);
  // Ye sab states aapko add karni hai agar missing hai to:
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [cameraStream, setCameraStream] = useState(null);
  const [cameraError, setCameraError] = useState("");

  const [isSubmittingWhatsApp, setIsSubmittingWhatsApp] = useState(false);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  const formatDateToDDMMYYYY = (date) => {
    const day = date.getDate().toString().padStart(2, "0");
    const month = (date.getMonth() + 1).toString().padStart(2, "0");
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  };

  const isEmpty = (value) => {
    return (
      value === null ||
      value === undefined ||
      (typeof value === "string" && value.trim() === "")
    );
  };

  useEffect(() => {
    const role = sessionStorage.getItem("role");
    const user = sessionStorage.getItem("username");
    setUserRole(role || "");
    setUsername(user || "");
  }, []);

  const parseGoogleSheetsDate = (dateStr) => {
    if (!dateStr) return "";

    if (typeof dateStr === "string" && dateStr.match(/^\d{2}\/\d{2}\/\d{4}$/)) {
      return dateStr;
    }

    if (typeof dateStr === "string" && dateStr.startsWith("Date(")) {
      const match = /Date$$(\d+),(\d+),(\d+)$$/.exec(dateStr);
      if (match) {
        const year = Number.parseInt(match[1], 10);
        const month = Number.parseInt(match[2], 10);
        const day = Number.parseInt(match[3], 10);
        return `${day.toString().padStart(2, "0")}/${(month + 1)
          .toString()
          .padStart(2, "0")}/${year}`;
      }
    }

    try {
      const date = new Date(dateStr);
      if (!isNaN(date.getTime())) {
        return formatDateToDDMMYYYY(date);
      }
    } catch (error) {
      console.error("Error parsing date:", error);
    }

    return dateStr;
  };

  const parseDateFromDDMMYYYY = (dateStr) => {
    if (!dateStr || typeof dateStr !== "string") return null;
    const parts = dateStr.split("/");
    if (parts.length !== 3) return null;
    return new Date(parts[2], parts[1] - 1, parts[0]);
  };

  const sortDateWise = (a, b) => {
    const dateStrA = a["col6"] || "";
    const dateStrB = b["col6"] || "";
    const dateA = parseDateFromDDMMYYYY(dateStrA);
    const dateB = parseDateFromDDMMYYYY(dateStrB);
    if (!dateA) return 1;
    if (!dateB) return -1;
    return dateA.getTime() - dateB.getTime();
  };

  const translateValue = (value, columnType = 'auto') => {
    if (!value) return "—";
    const lowerValue = value.toString().toLowerCase().trim();

    // Frequency mapping
    const freqKeys = {
      'daily': 'assignTask.daily',
      'weekly': 'assignTask.weekly',
      'fortnightly': 'assignTask.fortnightly',
      'monthly': 'assignTask.monthly',
      'quarterly': 'assignTask.quarterly',
      'half-yearly': 'assignTask.halfYearly',
      'yearly': 'assignTask.yearly',
      'one-time': 'assignTask.oneTime'
    };

    // Status mapping
    const statusKeys = {
      'completed': 'assignTask.completed',
      'pending': 'assignTask.pending',
      'not required': 'common.notRequired',
      'in progress': 'assignTask.inProgress',
      'yes': 'common.yes',
      'no': 'common.no',
      'done': 'assignTask.completed'
    };

    // Enable Reminders / Require Attachment mapping (Yes/No)
    const yesNoKeys = {
      'yes': 'common.yes',
      'no': 'common.no',
      'enabled': 'common.yes',
      'disabled': 'common.no',
      'true': 'common.yes',
      'false': 'common.no'
    };

    // Auto-detect or use specified column type
    if (columnType === 'frequency' || columnType === 'auto') {
      if (freqKeys[lowerValue]) return t(freqKeys[lowerValue]);
    }
    
    if (columnType === 'status' || columnType === 'auto') {
      if (statusKeys[lowerValue]) return t(statusKeys[lowerValue]);
    }
    
    if (columnType === 'yesno' || columnType === 'auto') {
      if (yesNoKeys[lowerValue]) return t(yesNoKeys[lowerValue]);
    }

    return value;
  };

  const resetFilters = () => {
    setSearchTerm("");
    setSelectedMembers([]);
    setStartDate("");
    setEndDate("");
  };

  // Memoized filtered data to prevent unnecessary re-renders
  const filteredAccountData = useMemo(() => {
    const filtered = searchTerm
      ? accountData.filter((account) =>
        Object.values(account).some(
          (value) =>
            value &&
            value.toString().toLowerCase().includes(searchTerm.toLowerCase())
        )
      )
      : accountData;

    return filtered.sort(sortDateWise);
  }, [accountData, searchTerm]);
  // Camera cleanup when component unmounts
  useEffect(() => {
    return () => {
      if (cameraStream) {
        cameraStream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [cameraStream]);

  const filteredHistoryData = useMemo(() => {
    return historyData
      .filter((item) => {
        const matchesSearch = searchTerm
          ? Object.values(item).some(
            (value) =>
              value &&
              value
                .toString()
                .toLowerCase()
                .includes(searchTerm.toLowerCase())
          )
          : true;

        const matchesMember =
          selectedMembers.length > 0
            ? selectedMembers.includes(item["col4"])
            : true;

        let matchesDateRange = true;
        if (startDate || endDate) {
          const itemDate = parseDateFromDDMMYYYY(item["col10"]);
          if (!itemDate) return false;

          if (startDate) {
            const startDateObj = new Date(startDate);
            startDateObj.setHours(0, 0, 0, 0);
            if (itemDate < startDateObj) matchesDateRange = false;
          }

          if (endDate) {
            const endDateObj = new Date(endDate);
            endDateObj.setHours(23, 59, 59, 999);
            if (itemDate > endDateObj) matchesDateRange = false;
          }
        }

        return matchesSearch && matchesMember && matchesDateRange;
      })
      .sort((a, b) => {
        const dateStrA = a["col10"] || "";
        const dateStrB = b["col10"] || "";
        const dateA = parseDateFromDDMMYYYY(dateStrA);
        const dateB = parseDateFromDDMMYYYY(dateStrB);
        if (!dateA) return 1;
        if (!dateB) return -1;
        return dateB.getTime() - dateA.getTime();
      });
  }, [historyData, searchTerm, selectedMembers, startDate, endDate]);

  const getTaskStatistics = () => {
    const totalCompleted = historyData.length;
    const memberStats =
      selectedMembers.length > 0
        ? selectedMembers.reduce((stats, member) => {
          const memberTasks = historyData.filter(
            (task) => task["col4"] === member
          ).length;
          return {
            ...stats,
            [member]: memberTasks,
          };
        }, {})
        : {};
    const filteredTotal = filteredHistoryData.length;

    return {
      totalCompleted,
      memberStats,
      filteredTotal,
    };
  };

  const handleMemberSelection = (member) => {
    setSelectedMembers((prev) => {
      if (prev.includes(member)) {
        return prev.filter((item) => item !== member);
      } else {
        return [...prev, member];
      }
    });
  };

  const getFilteredMembersList = () => {
    if (userRole === "admin") {
      return membersList;
    } else {
      return membersList.filter(
        (member) => member.toLowerCase() === username.toLowerCase()
      );
    }
  };

  const fetchSheetData = useCallback(async () => {
    try {
      setLoading(true);
      const pendingAccounts = [];
      const historyRows = [];

      const response = await fetch(
        `${CONFIG.APPS_SCRIPT_URL}?sheet=${CONFIG.SHEET_NAME}&action=fetch`
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch data: ${response.status}`);
      }

      const text = await response.text();
      let data;

      try {
        data = JSON.parse(text);
      } catch (parseError) {
        const jsonStart = text.indexOf("{");
        const jsonEnd = text.lastIndexOf("}");
        if (jsonStart !== -1 && jsonEnd !== -1) {
          const jsonString = text.substring(jsonStart, jsonEnd + 1);
          data = JSON.parse(jsonString);
        } else {
          throw new Error("Invalid JSON response from server");
        }
      }

      const currentUsername = sessionStorage.getItem("username");
      const currentUserRole = sessionStorage.getItem("role");

      const today = new Date();
      const tomorrow = new Date(today);
      tomorrow.setDate(today.getDate() + 1);

      const todayStr = formatDateToDDMMYYYY(today);
      const tomorrowStr = formatDateToDDMMYYYY(tomorrow);

      console.log("Filtering dates:", { todayStr, tomorrowStr });

      const membersSet = new Set();

      let rows = [];
      if (data.table && data.table.rows) {
        rows = data.table.rows;
      } else if (Array.isArray(data)) {
        rows = data;
      } else if (data.values) {
        rows = data.values.map((row) => ({
          c: row.map((val) => ({ v: val })),
        }));
      }

      rows.forEach((row, rowIndex) => {
        if (rowIndex === 0) return;

        let rowValues = [];
        if (row.c) {
          rowValues = row.c.map((cell) =>
            cell && cell.v !== undefined ? cell.v : ""
          );
        } else if (Array.isArray(row)) {
          rowValues = row;
        } else {
          console.log("Unknown row format:", row);
          return;
        }

        const assignedTo = rowValues[4] || t('delegation.unassigned');
        membersSet.add(assignedTo);

        const isUserMatch =
          currentUserRole === "admin" ||
          assignedTo.toLowerCase() === currentUsername.toLowerCase();
        if (!isUserMatch && currentUserRole !== "admin") return;

        const columnGValue = rowValues[6];
        const columnKValue = rowValues[10];
        const columnMValue = rowValues[12];

        if (columnMValue && columnMValue.toString().trim() === "DONE") {
          return;
        }

        const rowDateStr = columnGValue ? String(columnGValue).trim() : "";
        const formattedRowDate = parseGoogleSheetsDate(rowDateStr);

        const googleSheetsRowIndex = rowIndex + 1;

        // Create stable unique ID using task ID and row index
        const taskId = rowValues[1] || "";
        const stableId = taskId
          ? `task_${taskId}_${googleSheetsRowIndex}`
          : `row_${googleSheetsRowIndex}_${Math.random()
            .toString(36)
            .substring(2, 15)}`;

        const rowData = {
          _id: stableId, // More stable ID
          _rowIndex: googleSheetsRowIndex,
          _taskId: taskId,
        };

        const columnHeaders = [
          { id: "col0", label: "Timestamp", type: "string" },
          { id: "col1", label: "Task ID", type: "string" },
          { id: "col2", label: "Firm", type: "string" },
          { id: "col3", label: "Given By", type: "string" },
          { id: "col4", label: "Name", type: "string" },
          { id: "col5", label: "Task Description", type: "string" },
          { id: "col6", label: "Task Start Date", type: "date" },
          { id: "col7", label: "Freq", type: "string" },
          { id: "col8", label: "Enable Reminders", type: "string" },
          { id: "col9", label: "Require Attachment", type: "string" },
          { id: "col10", label: "Actual", type: "date" },
          { id: "col11", label: "Column L", type: "string" },
          { id: "col12", label: "Status", type: "string" },
          { id: "col13", label: "Remarks", type: "string" },
          { id: "col14", label: "Uploaded Image", type: "string" },
          { id: "col15", label: "Done Status", type: "string" },
        ];

        columnHeaders.forEach((header, index) => {
          const cellValue = rowValues[index];
          if (
            header.type === "date" ||
            (cellValue && String(cellValue).startsWith("Date("))
          ) {
            rowData[header.id] = cellValue
              ? parseGoogleSheetsDate(String(cellValue))
              : "";
          } else if (
            header.type === "number" &&
            cellValue !== null &&
            cellValue !== ""
          ) {
            rowData[header.id] = cellValue;
          } else {
            rowData[header.id] = cellValue !== null ? cellValue : "";
          }
        });

        // console.log(`Row ${rowIndex}: Task ID = ${rowData.col1}, Google Sheets Row = ${googleSheetsRowIndex}`)

        const hasColumnG = !isEmpty(columnGValue);
        const isColumnKEmpty = isEmpty(columnKValue);

        if (hasColumnG && isColumnKEmpty) {
          const rowDate = parseDateFromDDMMYYYY(formattedRowDate);
          const isToday = formattedRowDate === todayStr;
          const isTomorrow = formattedRowDate === tomorrowStr;
          const isPastDate = rowDate && rowDate <= today;

          if (isToday || isTomorrow || isPastDate) {
            pendingAccounts.push(rowData);
          }
        } else if (hasColumnG && !isColumnKEmpty) {
          const isUserHistoryMatch =
            currentUserRole === "admin" ||
            assignedTo.toLowerCase() === currentUsername.toLowerCase();
          if (isUserHistoryMatch) {
            historyRows.push(rowData);
          }
        }
      });

      setMembersList(Array.from(membersSet).sort());
      setAccountData(pendingAccounts);
      setHistoryData(historyRows);
      setLoading(false);
    } catch (error) {
      console.error("Error fetching sheet data:", error);
      setError("Failed to load account data: " + error.message);
      setLoading(false);
    }
  }, []);

  const handleHistoryCheckboxClick = useCallback((e, id, currentStatus) => {
    e.stopPropagation();
    if (currentStatus === "DONE") return; // Don't allow selection if already DONE

    const isChecked = e.target.checked;
    setSelectedHistoryItems((prev) => {
      const newSelected = new Set(prev);
      if (isChecked) {
        newSelected.add(id);
      } else {
        newSelected.delete(id);
      }
      return newSelected;
    });
  }, []);

  const handleSubmitHistoryDone = async () => {
    const selectedHistoryArray = Array.from(selectedHistoryItems);

    if (selectedHistoryArray.length === 0) {
      alert(t('delegation.selectAtLeastOneDone'));
      return;
    }

    setIsSubmittingHistory(true);

    try {
      const submissionData = selectedHistoryArray.map((id) => {
        const item = historyData.find((history) => history._id === id);
        return {
          taskId: item["col1"],
          rowIndex: item._rowIndex,
          actualDate: item["col10"] || "",
          status: item["col12"] || "",
          remarks: item["col13"] || "",
          imageUrl: item["col14"] || "",
          columnPValue: "DONE", // Column P में "DONE" submit hoga
        };
      });

      const formData = new FormData();
      formData.append("sheetName", CONFIG.SHEET_NAME);
      formData.append("action", "updateTaskData");
      formData.append("rowData", JSON.stringify(submissionData));

      const response = await fetch(CONFIG.APPS_SCRIPT_URL, {
        method: "POST",
        body: formData,
      });

      const result = await response.json();

      if (result.success) {
        setHistoryData((prev) =>
          prev.map((item) =>
            selectedHistoryItems.has(item._id)
              ? { ...item, col15: "DONE" }
              : item
          )
        );

        setSelectedHistoryItems(new Set());
        setSuccessMessage(
          t('delegation.successfullyMarkedDone').replace('{count}', selectedHistoryArray.length)
        );
      } else {
        throw new Error(result.error || "Submission failed");
      }
    } catch (error) {
      console.error("Submission error:", error);
      alert(t('delegation.failedMarkDone') + ": " + error.message);
    } finally {
      setIsSubmittingHistory(false);
    }
  };

  const handleWhatsAppSubmit = async () => {
    const selectedItemsArray = Array.from(selectedItems);

    if (selectedItemsArray.length === 0) {
      alert("Please select at least one item to submit");
      return;
    }

    setIsSubmittingWhatsApp(true);

    try {
      const today = new Date();
      const todayFormatted = formatDateToDDMMYYYY(today);

      await Promise.all(
        selectedItemsArray.map(async (id) => {
          const item = accountData.find((account) => account._id === id);

          const whatsappRowData = [
            todayFormatted, // Time Stamp (Column A)
            item["col1"] || "", // Task ID (Column B)
            "Checklist", // Stage (Column C) - Fixed
          ];

          const insertFormData = new FormData();
          insertFormData.append("sheetName", "WhatsappMessage"); // Your sheet name
          insertFormData.append("action", "insert");
          insertFormData.append("rowData", JSON.stringify(whatsappRowData));

          return fetch(CONFIG.APPS_SCRIPT_URL, {
            method: "POST",
            body: insertFormData,
          });
        })
      );

      setSuccessMessage(
        t('delegation.successfullySentWhatsApp').replace('{count}', selectedItemsArray.length)
      );
      setSelectedItems(new Set());

      setTimeout(() => {
        fetchSheetData();
      }, 2000);
    } catch (error) {
      console.error("WhatsApp submission error:", error);
      alert(t('delegation.failedSubmitWhatsApp') + ": " + error.message);
    } finally {
      setIsSubmittingWhatsApp(false);
    }
  };

  useEffect(() => {
    fetchSheetData();
  }, [fetchSheetData]);

  // Fixed checkbox handlers with better state management
  const handleSelectItem = useCallback((id, isChecked) => {
    console.log(`Checkbox action: ${id} -> ${isChecked}`);

    setSelectedItems((prev) => {
      const newSelected = new Set(prev);

      if (isChecked) {
        newSelected.add(id);
      } else {
        newSelected.delete(id);
        // Clean up related data when unchecking
        setAdditionalData((prevData) => {
          const newAdditionalData = { ...prevData };
          delete newAdditionalData[id];
          return newAdditionalData;
        });
        setRemarksData((prevRemarks) => {
          const newRemarksData = { ...prevRemarks };
          delete newRemarksData[id];
          return newRemarksData;
        });
      }

      console.log(`Updated selection: ${Array.from(newSelected)}`);
      return newSelected;
    });
  }, []);

  const handleCheckboxClick = useCallback(
    (e, id) => {
      e.stopPropagation();
      const isChecked = e.target.checked;
      console.log(`Checkbox clicked: ${id}, checked: ${isChecked}`);
      handleSelectItem(id, isChecked);
    },
    [handleSelectItem]
  );

  const handleSelectAllItems = useCallback(
    (e) => {
      e.stopPropagation();
      const checked = e.target.checked;
      console.log(`Select all clicked: ${checked}`);

      if (checked) {
        const allIds = filteredAccountData.map((item) => item._id);
        setSelectedItems(new Set(allIds));
        console.log(`Selected all items: ${allIds}`);
      } else {
        setSelectedItems(new Set());
        setAdditionalData({});
        setRemarksData({});
        console.log("Cleared all selections");
      }
    },
    [filteredAccountData]
  );

  // Add these functions in your component (around line 150-250, after other functions)

  const startCamera = async () => {
    try {
      setCameraError("");
      setIsCameraLoading(true);

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setCameraError(t('delegation.cameraNotSupported'));
        setIsCameraLoading(false);
        return;
      }


      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "environment",
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });


      setCameraStream(stream);
      setIsCameraOpen(true);

      if (videoRef.current) {
        videoRef.current.srcObject = stream;

        await new Promise((resolve, reject) => {
          const video = videoRef.current;
          if (!video) {
            reject(new Error("Video ref lost"));
            return;
          }

          let metadataLoaded = false;
          let canPlay = false;

          const checkReady = () => {
            if (metadataLoaded && canPlay) {

              resolve();
            }
          };

          video.onloadedmetadata = () => {
            metadataLoaded = true;
            checkReady();
          };

          video.oncanplay = () => {
            console.log("▶️ Can play event fired");
            canPlay = true;
            checkReady();
          };

          video.onerror = (err) => {
            console.error("Video error:", err);
            reject(err);
          };

          setTimeout(() => {
            if (!metadataLoaded || !canPlay) {
              reject(new Error("Video initialization timeout"));
            }
          }, 10000);
        });

        await videoRef.current.play();
        console.log("🎬 Camera streaming successfully!");
      }
    } catch (error) {
      console.error("Camera error:", error);

      if (error.name === "NotAllowedError") {
        setCameraError(t('delegation.cameraAccessDenied'));
      } else if (error.name === "NotFoundError") {
        setCameraError(t('delegation.noCameraFound'));
      } else if (error.name === "NotReadableError") {
        setCameraError(t('delegation.cameraInUse'));
      } else {
        setCameraError(t('delegation.cameraError') + ": " + error.message);
      }
    } finally {
      setIsCameraLoading(false);
    }
  };

  const stopCamera = () => {

    if (cameraStream) {
      cameraStream.getTracks().forEach((track) => {
        track.stop();
        console.log("Track stopped:", track.kind);
      });
      setCameraStream(null);
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    setIsCameraOpen(false);
    setCameraError("");
    setIsCameraLoading(false);
    setCurrentCaptureId(null);

    console.log("✅ Camera stopped successfully");
  };

  const capturePhoto = async () => {
    if (!videoRef.current || !currentCaptureId) {
      alert(t('delegation.cameraNotInitialized'));
      return;
    }

    const video = videoRef.current;

    try {


      if (video.readyState < 2) {
        alert(t('delegation.cameraStillLoading'));
        return;
      }

      if (!video.videoWidth || !video.videoHeight) {
        alert(t('delegation.cameraDimensionsUnavailable'));
        return;
      }

      if (!cameraStream || !cameraStream.active) {
        alert(t('delegation.cameraStreamInactive'));
        return;
      }

      console.log("📸 Starting photo capture...");

      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      const context = canvas.getContext("2d");
      if (!context) {
        alert(t('delegation.failedCanvasContext'));
        return;
      }

      context.drawImage(video, 0, 0, canvas.width, canvas.height);

      const blob = await new Promise((resolve, reject) => {
        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(blob);
            } else {
              reject(new Error("Failed to create blob"));
            }
          },
          "image/jpeg",
          0.92
        );
      });

      console.log(
        "✅ Photo captured! Size:",
        (blob.size / 1024).toFixed(2),
        "KB"
      );

      const file = new File([blob], `camera-${Date.now()}.jpg`, {
        type: "image/jpeg",
      });

      stopCamera();

      handleImageUpload(currentCaptureId, { target: { files: [file] } });

      alert(t('delegation.photoCapturedSuccess'));
    } catch (error) {
      console.error("❌ Capture error:", error);
      alert(t('delegation.failedCapturePhoto') + ": " + error.message);
    }
  };

  const fileToBase64 = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result);
      reader.onerror = (error) => reject(error);
    });
  };

  const toggleHistory = () => {
    setShowHistory((prev) => !prev);
    resetFilters();
  };

  const handleSubmit = async () => {
    const selectedItemsArray = Array.from(selectedItems);

    if (selectedItemsArray.length === 0) {
      alert("Please select at least one item to submit");
      return;
    }

    const missingRemarks = selectedItemsArray.filter((id) => {
      const additionalStatus = additionalData[id];
      const remarks = remarksData[id];
      return (
        (additionalStatus === "Not Required" ||
          additionalStatus === "Pending") &&
        (!remarks || remarks.trim() === "")
      );
    });

    if (missingRemarks.length > 0) {
      alert(
        t('common.provideRemarksForNotRequired').replace('{count}', missingRemarks.length)
      );
      return;
    }

    const missingRequiredImages = selectedItemsArray.filter((id) => {
      const item = accountData.find((account) => account._id === id);
      const requiresAttachment =
        item["col9"] && item["col9"].toUpperCase() === "YES";
      return requiresAttachment && !item.image;
    });

    if (missingRequiredImages.length > 0) {
      alert(
        t('delegation.uploadRequiredImages').replace('{count}', missingRequiredImages.length)
      );
      return;
    }

    setIsSubmitting(true);

    try {
      const today = new Date();
      const todayFormatted = formatDateToDDMMYYYY(today);

      const submissionData = await Promise.all(
        selectedItemsArray.map(async (id) => {
          const item = accountData.find((account) => account._id === id);

          console.log(`Preparing submission for item:`, {
            id: id,
            taskId: item["col1"],
            rowIndex: item._rowIndex,
            expectedTaskId: item._taskId,
          });

          let imageUrl = "";

          if (item.image instanceof File) {
            try {
              const base64Data = await fileToBase64(item.image);

              const uploadFormData = new FormData();
              uploadFormData.append("action", "uploadFile");
              uploadFormData.append("base64Data", base64Data);
              uploadFormData.append(
                "fileName",
                `task_${item["col1"]}_${Date.now()}.${item.image.name
                  .split(".")
                  .pop()}`
              );
              uploadFormData.append("mimeType", item.image.type);
              uploadFormData.append("folderId", CONFIG.DRIVE_FOLDER_ID);

              const uploadResponse = await fetch(CONFIG.APPS_SCRIPT_URL, {
                method: "POST",
                body: uploadFormData,
              });

              const uploadResult = await uploadResponse.json();
              if (uploadResult.success) {
                imageUrl = uploadResult.fileUrl;
              }
            } catch (uploadError) {
              console.error("Error uploading image:", uploadError);
            }
          }

          return {
            taskId: item["col1"],
            rowIndex: item._rowIndex,
            actualDate: todayFormatted,
            status: additionalData[id] || "",
            remarks: remarksData[id] || "",
            imageUrl: imageUrl,
          };
        })
      );


      const formData = new FormData();
      formData.append("sheetName", CONFIG.SHEET_NAME);
      formData.append("action", "updateTaskData");
      formData.append("rowData", JSON.stringify(submissionData));

      const response = await fetch(CONFIG.APPS_SCRIPT_URL, {
        method: "POST",
        body: formData,
      });

      const result = await response.json();

      if (result.success) {
        // Get the submitted items data before removing them
        const submittedItems = selectedItemsArray.map((id) => {
          const item = accountData.find((account) => account._id === id);
          return {
            ...item,
            col10: todayFormatted, // Actual date
            col12: additionalData[id] || "", // Status
            col13: remarksData[id] || "", // Remarks
            col14: item.image
              ? typeof item.image === "string"
                ? item.image
                : "Image uploaded"
              : "", // Image info
          };
        });

        // Remove submitted items from current account data
        setAccountData((prev) =>
          prev.filter((item) => !selectedItems.has(item._id))
        );

        // Add submitted items to history data
        setHistoryData((prev) => [...submittedItems, ...prev]);

        setSuccessMessage(
          t('delegation.successfullyProcessed')
            .replace('{count}', selectedItemsArray.length)
            .replace('{sheetName}', CONFIG.SHEET_NAME) + " " + t('delegation.tasksMovedToHistory')
        );
        setSelectedItems(new Set());
        setAdditionalData({});
        setRemarksData({});

        // Remove the setTimeout and fetchSheetData call - no longer needed
      } else {
        throw new Error(result.error || "Submission failed");
      }
    } catch (error) {
      console.error("Submission error:", error);
      alert(t('delegation.failedSubmitRecords') + ": " + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Convert Set to Array for display
  const selectedItemsCount = selectedItems.size;

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <h1 className="text-2xl font-bold tracking-tight text-purple-700">
            {showHistory
              ? t(CONFIG.PAGE_CONFIG.historyTitle)
              : t(CONFIG.PAGE_CONFIG.title)}
          </h1>

          {/* Right controls */}
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            {/* Search */}
            <div className="relative w-full sm:w-auto">
              <Search
                className="absolute left-3 top-1/2 -translate-y-1/2 transform text-gray-400"
                size={18}
              />
              <input
                type="text"
                placeholder={showHistory ? t('common.search') + " " + t('delegation.historyTitle').toLowerCase() + "..." : t('common.search') + " " + t('assignTask.checklistTasks').toLowerCase() + "..."}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full rounded-md border border-purple-200 py-2 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>

            {/* History toggle */}
            <button
              onClick={toggleHistory}
              className="flex items-center justify-center rounded-md bg-gradient-to-r from-blue-500 to-indigo-600 py-2 px-4 text-sm font-medium text-white hover:from-blue-600 hover:to-indigo-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              {showHistory ? (
                <>
                  <ArrowLeft className="mr-1 h-4 w-4" />
                  <span>{t('delegation.backToTasks')}</span>
                </>
              ) : (
                <>
                  <History className="mr-1 h-4 w-4" />
                  <span>{t('delegation.viewHistory')}</span>
                </>
              )}
            </button>

            {/* History DONE button */}
            {showHistory && selectedHistoryItems.size > 0 && (
              <button
                onClick={handleSubmitHistoryDone}
                disabled={isSubmittingHistory}
                className="flex items-center justify-center rounded-md bg-gradient-to-r from-green-600 to-emerald-600 py-2 px-4 text-sm font-medium text-white hover:from-green-700 hover:to-emerald-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSubmittingHistory
                  ? t('delegation.processing')
                  : t('common.markAsDoneWithCount').replace('{count}', selectedHistoryItems.size)}
              </button>
            )}

            {/* Task action buttons (only when NOT history) */}
            {!showHistory && (
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <button
                  onClick={handleSubmit}
                  disabled={selectedItemsCount === 0 || isSubmitting}
                  className="flex items-center justify-center rounded-md bg-gradient-to-r from-purple-600 to-pink-600 py-2 px-4 text-sm font-medium text-white hover:from-purple-700 hover:to-pink-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isSubmitting
                    ? t('messages.processing')
                    : `${t('delegation.markAsDone')} (${selectedItemsCount})`}
                </button>

                {/* WhatsApp button - sits next to submit on desktop, below on mobile */}
                <button
                  onClick={handleWhatsAppSubmit}
                  disabled={selectedItemsCount === 0 || isSubmittingWhatsApp}
                  className="flex items-center justify-center rounded-md bg-gradient-to-r from-green-600 to-emerald-600 py-2 px-4 text-sm font-medium text-white hover:from-green-700 hover:to-emerald-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isSubmittingWhatsApp
                    ? t('messages.processing')
                    : `${t('delegation.whatsappSubmit')} (${selectedItemsCount})`}
                </button>
              </div>
            )}
          </div>
        </div>


        {successMessage && (
          <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-md flex items-center justify-between">
            <div className="flex items-center">
              <CheckCircle2 className="h-5 w-5 mr-2 text-green-500" />
              {successMessage}
            </div>
            <button
              onClick={() => setSuccessMessage("")}
              className="text-green-500 hover:text-green-700"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        )}

        <div className="rounded-lg border border-purple-200 shadow-md bg-white overflow-hidden">
          <div className="bg-gradient-to-r from-purple-50 to-pink-50 border-b border-purple-100 p-4">
            <h2 className="text-purple-700 font-medium">
              {showHistory
                ? t('common.completedTasks').replace('{sheetName}', CONFIG.SHEET_NAME)
                : t('common.pendingTasks').replace('{sheetName}', CONFIG.SHEET_NAME)}
            </h2>
            <p className="text-purple-600 text-sm">
              {showHistory
                ? `${t(CONFIG.PAGE_CONFIG.historyDescription)} ${t('common.for')} ${userRole === "admin" ? t('common.allTasks') : t('common.yourTasks')} ${t('common.tasks')}`
                : t(CONFIG.PAGE_CONFIG.description)}
            </p>
          </div>

          {loading ? (
            <div className="text-center py-10">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-purple-500 mb-4"></div>
              <p className="text-purple-600">{t('common.loadingTaskData')}</p>
            </div>
          ) : error ? (
            <div className="bg-red-50 p-4 rounded-md text-red-800 text-center">
              {error}{" "}
              <button
                className="underline ml-2"
                onClick={() => window.location.reload()}
              >
                {t('delegation.tryAgain')}
              </button>
            </div>
          ) : showHistory ? (
            <>
              {/* History Filters */}
              <div className="p-4 border-b border-purple-100 bg-gray-50">
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  {/* Member filter card */}
                  {getFilteredMembersList().length > 0 && (
                    <div className="w-full rounded-lg border border-gray-200 bg-white p-3 md:w-auto">
                      <div className="mb-2 flex items-center">
                        <span className="text-sm font-medium text-purple-700">
                          {t('common.filterMember')}
                        </span>
                      </div>
                      <div className="flex max-h-32 flex-wrap gap-3 overflow-y-auto">
                        {getFilteredMembersList().map((member, idx) => (
                          <div key={idx} className="flex items-center">
                            <input
                              id={`member-${idx}`}
                              type="checkbox"
                              className="h-4 w-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                              checked={selectedMembers.includes(member)}
                              onChange={() => handleMemberSelection(member)}
                            />
                            <label
                              htmlFor={`member-${idx}`}
                              className="ml-2 text-sm text-gray-700"
                            >
                              {member}
                            </label>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Date range filter card */}
                  <div className="w-full rounded-lg border border-gray-200 bg-white p-3 md:w-auto">
                    <div className="mb-2 flex items-center">
                      <span className="text-sm font-medium text-purple-700">
                        {t('common.filterByDate')}
                      </span>
                    </div>
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                      <div className="flex items-center">
                        <label
                          htmlFor="start-date"
                          className="mr-1 text-sm text-gray-700"
                        >
                          {t('common.from')}
                        </label>
                        <input
                          id="start-date"
                          type="date"
                          value={startDate}
                          onChange={(e) => setStartDate(e.target.value)}
                          className="rounded-md border border-gray-200 p-1 text-sm"
                        />
                      </div>
                      <div className="flex items-center">
                        <label
                          htmlFor="end-date"
                          className="mr-1 text-sm text-gray-700"
                        >
                          {t('common.to')}
                        </label>
                        <input
                          id="end-date"
                          type="date"
                          value={endDate}
                          onChange={(e) => setEndDate(e.target.value)}
                          className="rounded-md border border-gray-200 p-1 text-sm"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Clear filters button */}
                  {(selectedMembers.length > 0 || startDate || endDate || searchTerm) && (
                    <div className="flex w-full items-start md:w-auto md:items-center">
                      <button
                        onClick={resetFilters}
                        className="w-full rounded-md bg-red-100 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-200 md:w-auto"
                      >
                        {t('common.clearAll')}
                      </button>
                    </div>
                  )}
                </div>
              </div>


              {/* Task Statistics */}
              <div className="p-4 border-b border-purple-100 bg-blue-50">
                <div className="flex flex-col">
                  <h3 className="text-sm font-medium text-purple-700">
                    {t('common.statsTitle')}
                  </h3>
                  <div className="flex flex-wrap gap-4">
                    <div className="rounded-md bg-white px-3 py-2 shadow-sm">
                      <span className="text-xs text-gray-500">
                        {t('common.totalCompleted')}
                      </span>
                      <div className="text-lg font-semibold text-blue-600">
                        {getTaskStatistics().totalCompleted}
                      </div>
                    </div>

                    {(selectedMembers.length > 0 ||
                      startDate ||
                      endDate ||
                      searchTerm) && (
                        <div className="px-3 py-2 bg-white rounded-md shadow-sm">
                          <span className="text-xs text-gray-500">
                            {t('common.filteredResults')}
                          </span>
                          <div className="text-lg font-semibold text-blue-600">
                            {getTaskStatistics().filteredTotal}
                          </div>
                        </div>
                      )}

                    {selectedMembers.map((member) => (
                      <div
                        key={member}
                        className="px-3 py-2 bg-white rounded-md shadow-sm"
                      >
                        <span className="text-xs text-gray-500">{member}</span>
                        <div className="text-lg font-semibold text-indigo-600">
                          {getTaskStatistics().memberStats[member]}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* History Table */}
              <div className="overflow-x-auto">
                {filteredHistoryData.length === 0 ? (
                  <table className="min-w-full divide-y divide-gray-200">
                    <tbody>
                      <tr>
                        <td
                          colSpan={14}
                          className="px-6 py-4 text-center text-gray-500"
                        >
                          {searchTerm ||
                            selectedMembers.length > 0 ||
                            startDate ||
                            endDate
                            ? t('history.noRecordsMatchingFilters')
                            : t('history.noCompletedRecords')}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                ) : (
                  <>
                    {/* Mobile: card layout */}
                    <div className="grid grid-cols-1 gap-3 md:hidden max-h-[420px] overflow-y-auto">
                      {/* Mobile select-all row */}
                      <div className="flex items-center gap-2 rounded-md bg-gray-50 px-3 py-2">
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                          checked={
                            filteredHistoryData.filter((h) => h["col15"] !== "DONE").length >
                            0 &&
                            selectedHistoryItems.size ===
                            filteredHistoryData.filter((h) => h["col15"] !== "DONE")
                              .length
                          }
                          onChange={(e) => {
                            if (e.target.checked) {
                              const selectableIds = filteredHistoryData
                                .filter((h) => h["col15"] !== "DONE")
                                .map((h) => h._id);
                              setSelectedHistoryItems(new Set(selectableIds));
                            } else {
                              setSelectedHistoryItems(new Set());
                            }
                          }}
                        />
                        <span className="text-xs font-medium text-gray-700">
                          {t('common.selectAllNonDone')}
                        </span>
                      </div>

                      {filteredHistoryData.map((history) => {
                        const isDone = history["col15"] === "DONE";
                        const isSelected = selectedHistoryItems.has(history._id);

                        return (
                          <div
                            key={history._id}
                            className={`rounded-lg border px-3 py-3 text-sm shadow-sm ${isDone
                              ? "bg-green-100 border-green-200"
                              : isSelected
                                ? "bg-purple-50 border-purple-200"
                                : "bg-white border-gray-200"
                              }`}
                          >
                            {/* Top row: checkbox + Task ID + Status */}
                            <div className="mb-2 flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <input
                                  type="checkbox"
                                  className="h-4 w-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                                  checked={isSelected}
                                  disabled={isDone}
                                  onChange={(e) =>
                                    handleHistoryCheckboxClick(
                                      e,
                                      history._id,
                                      history["col15"]
                                    )
                                  }
                                />
                                <span className="text-xs font-semibold text-gray-700">
                                  {history["col1"] || "—"}
                                </span>
                              </div>
                              <span
                                className={`inline-flex rounded-full px-2 py-1 text-[11px] font-semibold ${history["col12"] === "Completed"
                                  ? "bg-green-100 text-green-800"
                                  : history["col12"] === "Not Required"
                                    ? "bg-yellow-100 text-yellow-800"
                                    : history["col12"] === "Pending"
                                      ? "bg-red-100 text-red-800"
                                      : history["col12"] === "Yes"
                                        ? "bg-green-100 text-green-800"
                                        : history["col12"] === "No"
                                          ? "bg-red-100 text-red-800"
                                          : "bg-gray-100 text-gray-800"
                                  }`}
                              >
                                {translateValue(history["col12"])}
                              </span>
                            </div>

                            {/* Main info */}
                            <div className="space-y-1 text-xs text-gray-700">
                              <div className="flex justify-between gap-2">
                                <span className="font-semibold">{t('table.section')}:</span>
                                <span className="text-right">
                                  {history["col2"] || "—"}
                                </span>
                              </div>
                              <div className="flex justify-between gap-2">
                                <span className="font-semibold">{t('assignTask.givenBy')}:</span>
                                <span className="text-right">
                                  {history["col3"] || "—"}
                                </span>
                              </div>
                              <div className="flex justify-between gap-2">
                                <span className="font-semibold">{t('table.name')}:</span>
                                <span className="text-right">
                                  {history["col4"] || "—"}
                                </span>
                              </div>
                              <div className="mt-1">
                                <span className="font-semibold">{t('table.task')}:</span>
                                <p
                                  className="mt-0.5 break-words text-[13px]"
                                  title={history["col5"]}
                                >
                                  {history["col5"] || "—"}
                                </p>
                              </div>
                            </div>

                            {/* Dates + flags */}
                            <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                              <div className="rounded-md bg-yellow-50 p-1.5">
                                <div className="text-[11px] font-semibold text-gray-700">
                                  {t('table.taskStartDate')}
                                </div>
                                <div className="text-gray-900">
                                  {history["col6"] || "—"}
                                </div>
                              </div>
                              <div className="rounded-md bg-green-50 p-1.5">
                                <div className="text-[11px] font-semibold text-gray-700">
                                  {t('table.actualDate')}
                                </div>
                                <div className="text-gray-900">
                                  {history["col10"] || "—"}
                                </div>
                              </div>
                              <div className="rounded-md bg-gray-50 p-1.5">
                                <div className="text-[11px] font-semibold text-gray-700">
                                  {t('table.frequency')}
                                </div>
                                <div className="text-gray-900">
                                  {translateValue(history["col7"], 'frequency')}
                                </div>
                              </div>
                              <div className="rounded-md bg-gray-50 p-1.5">
                                <div className="text-sm font-medium text-gray-900">
                                  {t('assignTask.taskId')}: {history["col1"] || "—"}
                                </div>
                                <div className="text-xs text-purple-600">
                                  {t('table.date')}: {history["col11"] || "—"} | {t('assignTask.department')}: {history["col2"]}
                                </div>
                              </div>
                            </div>

                            {/* Remarks + attachment */}
                            <div className="mt-2 border-t border-gray-100 pt-2 text-xs">
                              <div className="mb-1">
                                <span className="font-semibold">{t('assignTask.remarks')}:</span>
                                <p
                                  className="mt-0.5 break-words"
                                  title={history["col13"]}
                                >
                                  {history["col13"] || "—"}
                                </p>
                              </div>
                              <div>
                                <span className="font-semibold">{t('table.image')}:</span>
                                {history["col14"] ? (
                                  <a
                                    href={history["col14"]}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="ml-1 inline-flex items-center text-blue-600 underline hover:text-blue-800"
                                  >
                                    <img
                                      src={
                                        history["col14"] || "/api/placeholder/32/32"
                                      }
                                      alt="Attachment"
                                      className="mr-2 h-6 w-6 rounded-md object-cover"
                                    />
                                    View
                                  </a>
                                ) : (
                                  <span className="ml-1 text-gray-400">
                                    {t('delegation.noAttachment')}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Desktop: original table view */}
                    <table className="hidden min-w-full divide-y divide-gray-200 md:table">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            <input
                              type="checkbox"
                              className="h-4 w-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                              checked={
                                filteredHistoryData.filter(
                                  (h) => h["col15"] !== "DONE"
                                ).length > 0 &&
                                selectedHistoryItems.size ===
                                filteredHistoryData.filter(
                                  (h) => h["col15"] !== "DONE"
                                ).length
                              }
                              onChange={(e) => {
                                if (e.target.checked) {
                                  const selectableIds = filteredHistoryData
                                    .filter((h) => h["col15"] !== "DONE")
                                    .map((h) => h._id);
                                  setSelectedHistoryItems(new Set(selectableIds));
                                } else {
                                  setSelectedHistoryItems(new Set());
                                }
                              }}
                            />
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            {t('table.taskId')}
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            {t('table.section')}
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            {t('assignTask.givenBy')}
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            {t('table.name')}
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            {t('table.taskDescription')}
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-yellow-50">
                            {t('table.taskStartDate')}
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            {t('table.frequency')}
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            {t('assignTask.enableReminders')}
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            {t('assignTask.requireAttachment')}
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-green-50">
                            {t('table.actualDate')}
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-blue-50">
                            {t('table.status')}
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-purple-50">
                            {t('table.remarks')}
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            {t('table.image')}
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {filteredHistoryData.map((history) => {
                          const isDone = history["col15"] === "DONE";
                          const isSelected = selectedHistoryItems.has(history._id);

                          return (
                            <tr
                              key={history._id}
                              className={`${isDone
                                ? "bg-green-100"
                                : isSelected
                                  ? "bg-purple-50"
                                  : ""
                                } hover:bg-gray-50`}
                            >
                              <td className="px-6 py-4 whitespace-nowrap">
                                <input
                                  type="checkbox"
                                  className="h-4 w-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                                  checked={isSelected}
                                  disabled={isDone}
                                  onChange={(e) =>
                                    handleHistoryCheckboxClick(
                                      e,
                                      history._id,
                                      history["col15"]
                                    )
                                  }
                                />
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="text-sm font-medium text-gray-900">
                                  {history["col1"] || "—"}
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="text-sm text-gray-900">
                                  {history["col2"] || "—"}
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="text-sm text-gray-900">
                                  {history["col3"] || "—"}
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="text-sm text-gray-900">
                                  {history["col4"] || "—"}
                                </div>
                              </td>
                              <td className="px-6 py-4">
                                <div
                                  className="max-w-xs whitespace-normal break-words text-sm text-gray-900"
                                  title={history["col5"]}
                                >
                                  {history["col5"] || "—"}
                                </div>
                              </td>
                              <td className="bg-yellow-50 px-6 py-4 whitespace-nowrap">
                                <div className="text-sm text-gray-900">
                                  {history["col6"] || "—"}
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="text-sm text-gray-900">
                                  {translateValue(history["col7"], 'frequency')}
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="text-sm text-gray-900">
                                  {translateValue(history["col8"], 'yesno')}
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="text-sm text-gray-900">
                                  {translateValue(history["col9"], 'yesno')}
                                </div>
                              </td>
                              <td className="bg-green-50 px-6 py-4 whitespace-nowrap">
                                <div className="text-sm font-medium text-gray-900">
                                  {history["col10"] || "—"}
                                </div>
                              </td>
                              <td className="bg-blue-50 px-6 py-4 whitespace-nowrap">
                                <span
                                  className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${history["col12"] === "Completed"
                                    ? "bg-green-100 text-green-800"
                                    : history["col12"] === "Not Required"
                                      ? "bg-yellow-100 text-yellow-800"
                                      : history["col12"] === "Pending"
                                        ? "bg-red-100 text-red-800"
                                        : history["col12"] === "Yes"
                                          ? "bg-green-100 text-green-800"
                                          : history["col12"] === "No"
                                            ? "bg-red-100 text-red-800"
                                            : "bg-gray-100 text-gray-800"
                                    }`}
                                >
                                  {translateValue(history["col12"])}
                                </span>
                              </td>
                              <td className="bg-purple-50 px-6 py-4">
                                <div
                                  className="max-w-xs whitespace-normal break-words text-sm text-gray-900"
                                  title={history["col13"]}
                                >
                                  {history["col13"] || "—"}
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                {history["col14"] ? (
                                  <a
                                    href={history["col14"]}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center text-blue-600 underline hover:text-blue-800"
                                  >
                                    <img
                                      src={
                                        history["col14"] || "/api/placeholder/32/32"
                                      }
                                      alt="Attachment"
                                      className="mr-2 h-8 w-8 rounded-md object-cover"
                                    />
                                    {t('delegation.view')}
                                  </a>
                                ) : (
                                  <span className="text-gray-400">{t('delegation.noAttachment')}</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </>
                )}
              </div>

            </>
          ) : (
            /* Regular Tasks Table */
            <div className="overflow-x-auto lg:overflow-visible">
              {/* Desktop Table */}
              <div className="hidden lg:block overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                          checked={
                            filteredAccountData.length > 0 &&
                            selectedItems.size === filteredAccountData.length
                          }
                          onChange={handleSelectAllItems}
                        />
                      </th>
                      {/* Desktop headers - all columns */}
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('table.taskId')}</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('table.section')}</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('assignTask.givenBy')}</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('table.name')}</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('table.taskDescription')}</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-yellow-50">{t('table.taskStartDate')}</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('table.frequency')}</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('assignTask.enableReminders')}</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('assignTask.requireAttachment')}</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('table.status')}</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('table.remarks')}</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('table.image')}</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredAccountData.length > 0 ? (
                      filteredAccountData.map((account) => {
                        const isSelected = selectedItems.has(account._id);
                        return (
                          <tr key={account._id} className={`${isSelected ? "bg-purple-50" : ""} hover:bg-gray-50`}>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <input
                                type="checkbox"
                                className="h-4 w-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                                checked={isSelected}
                                onChange={(e) => handleCheckboxClick(e, account._id)}
                              />
                            </td>
                            {/* Desktop table cells - all your existing code */}
                            <td className="px-6 py-4 whitespace-nowrap"><div className="text-sm text-gray-900">{account["col1"] || "—"}</div></td>
                            <td className="px-6 py-4 whitespace-nowrap"><div className="text-sm text-gray-900">{account["col2"] || "—"}</div></td>
                            <td className="px-6 py-4 whitespace-nowrap"><div className="text-sm text-gray-900">{account["col3"] || "—"}</div></td>
                            <td className="px-6 py-4 whitespace-nowrap"><div className="text-sm text-gray-900">{account["col4"] || "—"}</div></td>
                            <td className="px-6 py-4">
                              <div className="text-sm text-gray-900 max-w-xs whitespace-normal break-words" title={account["col5"]}>
                                {account["col5"] || "—"}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap bg-yellow-50"><div className="text-sm text-gray-900">{account["col6"] || "—"}</div></td>
                            <td className="px-6 py-4 whitespace-nowrap"><div className="text-sm text-gray-900">{translateValue(account["col7"], 'frequency')}</div></td>
                            <td className="px-6 py-4 whitespace-nowrap"><div className="text-sm text-gray-900">{translateValue(account["col8"], 'yesno')}</div></td>
                            <td className="px-6 py-4 whitespace-nowrap"><div className="text-sm text-gray-900">{translateValue(account["col9"], 'yesno')}</div></td>
                            <td className="px-6 py-4 whitespace-nowrap bg-yellow-50">
                              <select disabled={!isSelected} value={additionalData[account._id] || ""} onChange={(e) => {
                                setAdditionalData((prev) => ({ ...prev, [account._id]: e.target.value }));
                                if (e.target.value !== "Not Required" && e.target.value !== "Pending") {
                                  setRemarksData((prev) => { const newData = { ...prev }; delete newData[account._id]; return newData; });
                                }
                              }} className="border border-gray-300 rounded-md px-2 py-1 w-full disabled:bg-gray-100 disabled:cursor-not-allowed">
                                <option value="">{t('common.select')}</option>
                                <option value="Completed">{t('assignTask.completed')}</option>
                                <option value="Not Required">{t('common.notRequired')}</option>
                                <option value="Pending">{t('assignTask.pending')}</option>
                              </select>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap bg-orange-50">
                              <input
                                type="text"
                                placeholder={additionalData[account._id] === "Not Required" || additionalData[account._id] === "Pending" ? "Remarks required *" : "Enter remarks"}
                                disabled={!isSelected || !additionalData[account._id]}
                                value={remarksData[account._id] || ""}
                                onChange={(e) => setRemarksData((prev) => ({ ...prev, [account._id]: e.target.value }))}
                                className={`border rounded-md px-2 py-1 w-full disabled:bg-gray-100 disabled:cursor-not-allowed ${additionalData[account._id] === "Not Required" || additionalData[account._id] === "Pending" ? "border-red-300 bg-red-50" : "border-gray-300"}`}
                              />
                            </td>
                            <td className="px-3 py-4 bg-green-50 min-w-[120px]">
                              {/* Your existing image upload code */}
                              {account.image ? (
                                <div className="flex items-center">
                                  <img src={typeof account.image === "string" ? account.image : URL.createObjectURL(account.image)} alt="Receipt" className="h-10 w-10 object-cover rounded-md mr-2 flex-shrink-0" />
                                  <div className="flex flex-col min-w-0">
                                    <span className="text-xs text-gray-500 break-words">{account.image instanceof File ? account.image.name : t('delegation.uploadedReceipt')}</span>
                                    {account.image instanceof File ? (
                                      <span className="text-xs text-green-600">{t('delegation.readyToUpload')}</span>
                                    ) : (
                                      <button className="text-xs text-purple-600 hover:text-purple-800 break-words" onClick={() => window.open(account.image, "_blank")}>{t('common.viewFullImage')}</button>
                                    )}
                                  </div>
                                </div>
                              ) : (
                                <div className="flex flex-col gap-2">
                                  <label htmlFor={`upload-${account._id}`} className={`flex items-center cursor-pointer ${account["col9"]?.toUpperCase() === "YES" ? "text-red-600 font-medium" : "text-purple-600"} hover:text-purple-800`}>
                                    <Upload className="h-4 w-4 mr-1 flex-shrink-0" />
                                    <span className="text-xs break-words">
                                      {account["col9"]?.toUpperCase() === "YES" ? t('common.requiredUpload') : t('common.uploadReceipt')}
                                      {account["col9"]?.toUpperCase() === "YES" && <span className="text-red-500 ml-1">*</span>}
                                    </span>
                                  </label>
                                  <input id={`upload-${account._id}`} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => handleImageUpload(account._id, e)} disabled={!isSelected} />
                                  <button onClick={() => { console.log("Button clicked!", account._id, isSelected, isCameraLoading); setCurrentCaptureId(account._id); startCamera(); }} disabled={!isSelected || isCameraLoading} className="flex items-center text-blue-600 hover:text-blue-800 text-xs disabled:opacity-50 disabled:cursor-not-allowed">
                                    <Camera className="h-4 w-4 mr-1 flex-shrink-0" />
                                    <span>{isCameraLoading ? t('common.loading') : t('common.takePhoto')}</span>
                                  </button>
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={14} className="px-6 py-4 text-center text-gray-500">
                          {searchTerm ? t('common.noTasksFound') : t('common.noPendingTasks')}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Mobile Card View */}
              <div className="lg:hidden space-y-4 p-4">
                {filteredAccountData.length > 0 ? (
                  filteredAccountData.map((account) => {
                    const isSelected = selectedItems.has(account._id);
                    return (
                      <div key={account._id} className={`border rounded-lg p-4 shadow-sm ${isSelected ? "bg-purple-50 border-purple-200" : "bg-white border-gray-200"} hover:shadow-md transition-all`}>
                        {/* Mobile Header Row */}
                        <div className="flex items-center justify-between mb-3 pb-3 border-b border-gray-100">
                          <div className="flex items-center space-x-3">
                            <input
                              type="checkbox"
                              className="h-5 w-5 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                              checked={isSelected}
                              onChange={(e) => handleCheckboxClick(e, account._id)}
                            />
                            <div className="text-sm font-medium text-gray-900 flex items-center space-x-2">
                              <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs font-medium">#{account["col1"] || "—"}</span>
                              <span className="text-gray-600">{account["col4"] || "—"}</span>
                            </div>
                          </div>
                          <div className="flex items-center space-x-2">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${account["col9"]?.toUpperCase() === "YES"
                              ? "bg-red-100 text-red-800"
                              : "bg-green-100 text-green-800"
                              }`}>
                              {account["col9"]?.toUpperCase() === "YES" ? t('common.requiredUpload') : t('common.optional')}
                            </span>
                          </div>
                        </div>

                        {/* Task Details Grid */}
                        <div className="grid grid-cols-1 gap-3 mb-4">
                          <div className="space-y-1">
                            <span className="text-xs text-gray-500 font-medium">{t('common.department')}</span>
                            <span className="text-sm text-gray-900 font-medium">{account["col2"] || "—"}</span>
                          </div>
                          <div className="space-y-1">
                            <span className="text-xs text-gray-500 font-medium">{t('assignTask.givenBy')}</span>
                            <span className="text-sm text-gray-900">{account["col3"] || "—"}</span>
                          </div>
                          <div>
                            <span className="text-xs text-gray-500 font-medium block mb-1">{t('table.taskDescription')}</span>
                            <p className="text-sm text-gray-900 leading-relaxed">{account["col5"] || "—"}</p>
                          </div>
                          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-gray-100">
                              <div className="bg-yellow-50 p-3 rounded-lg">
                              <span className="text-xs text-yellow-800 font-medium block mb-1">{t('assignTask.startDate')}</span>
                              <span className="text-sm font-semibold text-gray-900">{account["col6"] || "—"}</span>
                            </div>
                            <div>
                              <span className="text-xs text-gray-500 font-medium block mb-1">{t('table.frequency')}</span>
                              <span className="text-sm text-gray-900">{translateValue(account["col7"], 'frequency')}</span>
                            </div>
                          </div>
                        </div>

                        {/* Action Section */}
                        <div className="space-y-3 pt-4 border-t border-gray-100">
                          <div className="flex flex-col sm:flex-row gap-3">
                            <div className="flex-1">
                              <label className="block text-xs font-medium text-gray-700 mb-1">{t('table.status')}</label>
                              <select
                                disabled={!isSelected}
                                value={additionalData[account._id] || ""}
                                onChange={(e) => {
                                  setAdditionalData((prev) => ({ ...prev, [account._id]: e.target.value }));
                                  if (e.target.value !== "Not Required" && e.target.value !== "Pending") {
                                    setRemarksData((prev) => { const newData = { ...prev }; delete newData[account._id]; return newData; });
                                  }
                                }}
                                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm disabled:bg-gray-100 disabled:cursor-not-allowed focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                              >
                                <option value="">{t('common.select')}</option>
                                <option value="Completed">{t('assignTask.completed')}</option>
                                <option value="Not Required">{t('common.notRequired')}</option>
                                <option value="Pending">{t('assignTask.pending')}</option>
                              </select>
                            </div>
                            <div className="flex-1">
                              <label className="block text-xs font-medium text-gray-700 mb-1">
                                {t('table.remarks')} {additionalData[account._id] === "Not Required" || additionalData[account._id] === "Pending" ? "*" : ""}
                              </label>
                              <input
                                type="text"
                                placeholder={additionalData[account._id] === "Not Required" || additionalData[account._id] === "Pending" ? t('common.remarksRequired') : t('delegation.enterRemarks')}
                                disabled={!isSelected || !additionalData[account._id]}
                                value={remarksData[account._id] || ""}
                                onChange={(e) => setRemarksData((prev) => ({ ...prev, [account._id]: e.target.value }))}
                                className={`w-full border rounded-md px-3 py-2 text-sm disabled:bg-gray-100 disabled:cursor-not-allowed focus:ring-2 focus:ring-purple-500 ${additionalData[account._id] === "Not Required" || additionalData[account._id] === "Pending"
                                  ? "border-red-300 bg-red-50 focus:ring-red-500"
                                  : "border-gray-300 focus:border-purple-500"
                                  }`}
                              />
                            </div>
                          </div>

                          {/* Image Upload Section */}
                          <div className={`p-4 rounded-lg border-2 border-dashed ${account.image
                            ? "border-green-300 bg-green-50"
                            : account["col9"]?.toUpperCase() === "YES"
                              ? "border-red-300 bg-red-50"
                              : "border-gray-300 bg-gray-50"
                            }`}>
                            {account.image ? (
                              <div className="flex items-start space-x-3">
                                <img
                                  src={typeof account.image === "string" ? account.image : URL.createObjectURL(account.image)}
                                  alt="Receipt"
                                  className="h-16 w-16 object-cover rounded-lg flex-shrink-0"
                                />
                                <div className="min-w-0 flex-1 pt-1">
                                  <p className="text-sm font-medium text-gray-900 truncate">{account.image instanceof File ? account.image.name : t('delegation.uploadedReceipt')}</p>
                                  {account.image instanceof File ? (
                                    <span className="inline-block px-2 py-1 text-xs bg-green-100 text-green-800 rounded-full mt-1">{t('delegation.readyToUpload')}</span>
                                  ) : (
                                    <button
                                      className="text-xs text-purple-600 hover:text-purple-800 underline mt-1"
                                      onClick={() => window.open(account.image, "_blank")}
                                    >
                                      {t('delegation.viewFullImage')} →
                                    </button>
                                  )}
                                </div>
                              </div>
                            ) : (
                              <div className="space-y-3">
                                <div className="flex flex-col sm:flex-row gap-3">
                                  <label
                                    htmlFor={`upload-${account._id}`}
                                    className={`flex-1 flex items-center justify-center p-3 rounded-lg font-medium text-sm cursor-pointer transition-colors ${account["col9"]?.toUpperCase() === "YES"
                                      ? "bg-red-100 text-red-800 border-2 border-red-300 hover:bg-red-200"
                                      : "bg-purple-100 text-purple-800 border-2 border-purple-300 hover:bg-purple-200"
                                      }`}
                                  >
                                    <Upload className="h-5 w-5 mr-2 flex-shrink-0" />
                                    {account["col9"]?.toUpperCase() === "YES" ? t('common.requiredUpload') + " *" : t('common.uploadReceipt')}
                                  </label>
                                  <input
                                    id={`upload-${account._id}`}
                                    type="file"
                                    accept="image/*"
                                    capture="environment"
                                    className="hidden"
                                    onChange={(e) => handleImageUpload(account._id, e)}
                                    disabled={!isSelected}
                                  />
                                  <button
                                    onClick={() => {
                                      console.log("Button clicked!", account._id, isSelected, isCameraLoading);
                                      setCurrentCaptureId(account._id);
                                      startCamera();
                                    }}
                                    disabled={!isSelected || isCameraLoading}
                                    className="flex-1 flex items-center justify-center p-3 bg-blue-100 text-blue-800 rounded-lg font-medium text-sm hover:bg-blue-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                  >
                                    <Camera className="h-5 w-5 mr-2 flex-shrink-0" />
                                    {isCameraLoading ? t('common.loading') : t('delegation.takePhoto')}
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Extra Info Row */}
                        <div className="flex items-center justify-between pt-3 mt-4 border-t border-gray-100 text-xs text-gray-500">
                          <span>{t('common.reminders')}: {account["col8"] || "—"}</span>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="text-center py-12">
                    <div className="text-gray-500 text-lg mb-2">
                      {searchTerm ? t('common.noTasksFound') : t('common.noPendingTasks')}
                    </div>
                  </div>
                )}
              </div>
            </div>

          )}
        </div>
        {/* Camera Modal - Add this before the last closing </div> */}
        {isCameraOpen && (
          <div className="fixed inset-0 bg-black bg-opacity-75 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full overflow-hidden">
              <div className="bg-blue-600 text-white px-4 py-3 flex items-center justify-between">
                <h3 className="text-lg font-semibold">📸 {t('delegation.takePhoto')}</h3>
                <button
                  onClick={stopCamera}
                  className="text-white hover:text-gray-200 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="relative bg-black">
                <video
                  ref={videoRef}
                  className="w-full h-[400px] object-cover"
                  autoPlay
                  playsInline
                  muted
                />

                {isCameraLoading && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50">
                    <div className="text-white text-center">
                      <div className="animate-spin rounded-full h-12 w-12 border-4 border-white border-t-transparent mx-auto mb-3"></div>
                      <p>{t('delegation.initializingCamera')}</p>
                    </div>
                  </div>
                )}
              </div>

              {cameraError && (
                <div className="bg-red-50 border-l-4 border-red-500 p-4">
                  <p className="text-sm text-red-700">{cameraError}</p>
                </div>
              )}

              <div className="p-4 bg-gray-50 flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={stopCamera}
                  className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400 transition-colors"
                >
                  {t('delegation.cancel')}
                </button>
                <button
                  type="button"
                  onClick={capturePhoto}
                  disabled={isCameraLoading}
                  className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  {t('delegation.capturePhotoButton')}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}

export default AccountDataPage;
