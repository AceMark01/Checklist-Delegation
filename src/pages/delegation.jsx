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
import AdminLayout from "../components/layout/AdminLayout";
import { useTranslation } from "../contexts/TranslationContext";

// Configuration object - Move all configurations here
const CONFIG = {
  // Google Apps Script URL
  APPS_SCRIPT_URL:
    "https://script.google.com/macros/s/AKfycbxR-N0y9pSElWscysbstP48Y8PDQ4-8mnFO_KkbDNP3nLt0rOsxcHa7jtqmKHuJRj6vdw/exec",

  // Google Drive folder ID for file uploads
  DRIVE_FOLDER_ID: "1Kv7Sca_-Z_O3ykRjkyofblz1iEXvMtm8",

  // Sheet names
  SOURCE_SHEET_NAME: "DELEGATION",
  TARGET_SHEET_NAME: "DELEGATION DONE",

  // Page configuration - will use translations
  PAGE_CONFIG: {
    title: "delegation.title",
    historyTitle: "delegation.historyTitle",
    description: "delegation.pendingDescription",
    historyDescription: "delegation.historyDescription",
  },
};

// Debounce hook for search optimization
function useDebounce(value, delay) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

function DelegationDataPage() {
  const { t } = useTranslation();
  const [accountData, setAccountData] = useState([]);
  const [selectedItems, setSelectedItems] = useState(new Set());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [additionalData, setAdditionalData] = useState({});
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [remarksData, setRemarksData] = useState({});
  const [historyData, setHistoryData] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const [statusData, setStatusData] = useState({});
  const [nextTargetDate, setNextTargetDate] = useState({});
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [userRole, setUserRole] = useState("");
  const [username, setUsername] = useState("");
  const [selectedHistoryItems, setSelectedHistoryItems] = useState(new Set());
  const [isSubmittingHistory, setIsSubmittingHistory] = useState(false);

  // Debounced search term for better performance
  const debouncedSearchTerm = useDebounce(searchTerm, 300);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [cameraStream, setCameraStream] = useState(null);
  const [cameraError, setCameraError] = useState("");
  const [isCameraLoading, setIsCameraLoading] = useState(false);
  const [currentCaptureId, setCurrentCaptureId] = useState(null);

  const [isSubmittingWhatsApp, setIsSubmittingWhatsApp] = useState(false);

  // Add these refs with other declarations
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  const formatDateToDDMMYYYY = useCallback((date) => {
    const day = date.getDate().toString().padStart(2, "0");
    const month = (date.getMonth() + 1).toString().padStart(2, "0");
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  }, []);

  // NEW: Function to create a proper date object for Google Sheets
  const createGoogleSheetsDate = useCallback((date) => {
    // Return a Date object that Google Sheets can properly interpret
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }, []);

  // NEW: Function to format date for Google Sheets submission
  const formatDateForGoogleSheets = useCallback((date) => {
    // Create a properly formatted date string that Google Sheets will recognize as a date
    const day = date.getDate().toString().padStart(2, "0");
    const month = (date.getMonth() + 1).toString().padStart(2, "0");
    const year = date.getFullYear();

    // Return in format that Google Sheets recognizes as date: DD/MM/YYYY
    // But we'll also include the raw date object for better compatibility
    return {
      formatted: `${day}/${month}/${year}`,
      dateObject: new Date(year, date.getMonth(), date.getDate()),
      // ISO format as fallback
      iso: date.toISOString().split("T")[0],
      // Special format for Google Sheets API
      googleSheetsValue: `=DATE(${year},${month},${day})`,
    };
  }, []);

  // NEW: Function to convert DD/MM/YYYY string to Google Sheets date format
  const convertToGoogleSheetsDate = useCallback(
    (dateString) => {
      if (!dateString || typeof dateString !== "string") return "";

      // If already in DD/MM/YYYY format
      if (dateString.includes("/")) {
        const [day, month, year] = dateString.split("/");
        const date = new Date(year, month - 1, day);
        if (!isNaN(date.getTime())) {
          return formatDateForGoogleSheets(date);
        }
      }

      // If in YYYY-MM-DD format (from HTML date input)
      if (dateString.includes("-")) {
        const [year, month, day] = dateString.split("-");
        const date = new Date(year, month - 1, day);
        if (!isNaN(date.getTime())) {
          return formatDateForGoogleSheets(date);
        }
      }

      return {
        formatted: dateString,
        dateObject: null,
        iso: "",
        googleSheetsValue: dateString,
      };
    },
    [formatDateForGoogleSheets]
  );

  const isEmpty = useCallback((value) => {
    return (
      value === null ||
      value === undefined ||
      (typeof value === "string" && value.trim() === "")
    );
  }, []);

  useEffect(() => {
    const role = sessionStorage.getItem("role");
    const user = sessionStorage.getItem("username");
    setUserRole(role || "");
    setUsername(user || "");
  }, []);

  useEffect(() => {
    return () => {
      if (cameraStream) {
        cameraStream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [cameraStream]);

  const parseGoogleSheetsDate = useCallback(
    (dateStr) => {
      if (!dateStr) return "";

      // If it's already in DD/MM/YYYY format, return as is
      if (
        typeof dateStr === "string" &&
        dateStr.match(/^\d{1,2}\/\d{1,2}\/\d{4}$/)
      ) {
        // Ensure proper padding for DD/MM/YYYY format
        const parts = dateStr.split("/");
        if (parts.length === 3) {
          const day = parts[0].padStart(2, "0");
          const month = parts[1].padStart(2, "0");
          const year = parts[2];
          return `${day}/${month}/${year}`;
        }
        return dateStr;
      }

      // Handle Google Sheets Date() format
      if (typeof dateStr === "string" && dateStr.startsWith("Date(")) {
        const match = /Date\((\d+),(\d+),(\d+)\)/.exec(dateStr);
        if (match) {
          const year = Number.parseInt(match[1], 10);
          const month = Number.parseInt(match[2], 10);
          const day = Number.parseInt(match[3], 10);
          return `${day.toString().padStart(2, "0")}/${(month + 1)
            .toString()
            .padStart(2, "0")}/${year}`;
        }
      }

      // Handle other date formats
      try {
        const date = new Date(dateStr);
        if (!isNaN(date.getTime())) {
          return formatDateToDDMMYYYY(date);
        }
      } catch (error) {
        console.error("Error parsing date:", error);
      }

      // If all else fails, return the original string
      return dateStr;
    },
    [formatDateToDDMMYYYY]
  );

  const formatDateForDisplay = useCallback(
    (dateStr) => {
      if (!dateStr) return "—";

      // If it's already in proper DD/MM/YYYY format, return as is
      if (
        typeof dateStr === "string" &&
        dateStr.match(/^\d{2}\/\d{2}\/\d{4}$/)
      ) {
        return dateStr;
      }

      // Try to parse and reformat
      return parseGoogleSheetsDate(dateStr) || "—";
    },
    [parseGoogleSheetsDate]
  );

  const parseDateFromDDMMYYYY = useCallback((dateStr) => {
    if (!dateStr || typeof dateStr !== "string") return null;
    const parts = dateStr.split("/");
    if (parts.length !== 3) return null;
    return new Date(parts[2], parts[1] - 1, parts[0]);
  }, []);

  const sortDateWise = useCallback(
    (a, b) => {
      const dateStrA = a["col6"] || "";
      const dateStrB = b["col6"] || "";
      const dateA = parseDateFromDDMMYYYY(dateStrA);
      const dateB = parseDateFromDDMMYYYY(dateStrB);
      if (!dateA) return 1;
      if (!dateB) return -1;
      return dateA.getTime() - dateB.getTime();
    },
    [parseDateFromDDMMYYYY]
  );

  const resetFilters = useCallback(() => {
    setSearchTerm("");
    setStartDate("");
    setEndDate("");
  }, []);

  // Get color based on data from column R
  const getRowColor = useCallback((colorCode) => {
    if (!colorCode) return "bg-white";

    const code = colorCode.toString().toLowerCase();
    switch (code) {
      case "red":
        return "bg-red-50 border-l-4 border-red-400";
      case "yellow":
        return "bg-yellow-50 border-l-4 border-yellow-400";
      case "green":
        return "bg-green-50 border-l-4 border-green-400";
      case "blue":
        return "bg-blue-50 border-l-4 border-blue-400";
      default:
        return "bg-white";
    }
  }, []);

  // Optimized filtered data with debounced search
  const filteredAccountData = useMemo(() => {
    const filtered = debouncedSearchTerm
      ? accountData.filter((account) =>
        Object.values(account).some(
          (value) =>
            value &&
            value
              .toString()
              .toLowerCase()
              .includes(debouncedSearchTerm.toLowerCase())
        )
      )
      : accountData;

    return filtered.sort(sortDateWise);
  }, [accountData, debouncedSearchTerm, sortDateWise]);

  // Updated history filtering with user filter based on column H
  const filteredHistoryData = useMemo(() => {
    return historyData
      .filter((item) => {
        // User filter: For non-admin users, check column H (col7) matches username
        const userMatch =
          userRole === "admin" ||
          (item["col7"] &&
            item["col7"].toLowerCase() === username.toLowerCase());

        if (!userMatch) return false;

        const matchesSearch = debouncedSearchTerm
          ? Object.values(item).some(
            (value) =>
              value &&
              value
                .toString()
                .toLowerCase()
                .includes(debouncedSearchTerm.toLowerCase())
          )
          : true;

        let matchesDateRange = true;
        if (startDate || endDate) {
          const itemDate = parseDateFromDDMMYYYY(item["col0"]);
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

        return matchesSearch && matchesDateRange;
      })
      .sort((a, b) => {
        const dateStrA = a["col0"] || "";
        const dateStrB = b["col0"] || "";
        const dateA = parseDateFromDDMMYYYY(dateStrA);
        const dateB = parseDateFromDDMMYYYY(dateStrB);
        if (!dateA) return 1;
        if (!dateB) return -1;
        return dateB.getTime() - dateA.getTime();
      });
  }, [
    historyData,
    debouncedSearchTerm,
    startDate,
    endDate,
    parseDateFromDDMMYYYY,
    userRole,
    username,
  ]);

  // Optimized data fetching with parallel requests
  const fetchSheetData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Parallel fetch both sheets for better performance
      const [mainResponse, historyResponse] = await Promise.all([
        fetch(
          `${CONFIG.APPS_SCRIPT_URL}?sheet=${CONFIG.SOURCE_SHEET_NAME}&action=fetch`
        ),
        fetch(
          `${CONFIG.APPS_SCRIPT_URL}?sheet=${CONFIG.TARGET_SHEET_NAME}&action=fetch`
        ).catch(() => null),
      ]);

      if (!mainResponse.ok) {
        throw new Error(`Failed to fetch data: ${mainResponse.status}`);
      }

      // Process main data
      const mainText = await mainResponse.text();
      let data;
      try {
        data = JSON.parse(mainText);
      } catch (parseError) {
        const jsonStart = mainText.indexOf("{");
        const jsonEnd = mainText.lastIndexOf("}");
        if (jsonStart !== -1 && jsonEnd !== -1) {
          const jsonString = mainText.substring(jsonStart, jsonEnd + 1);
          data = JSON.parse(jsonString);
        } else {
          throw new Error("Invalid JSON response from server");
        }
      }

      // Process history data if available
      let processedHistoryData = [];
      if (historyResponse && historyResponse.ok) {
        try {
          const historyText = await historyResponse.text();
          let historyData;
          try {
            historyData = JSON.parse(historyText);
          } catch (parseError) {
            const jsonStart = historyText.indexOf("{");
            const jsonEnd = historyText.lastIndexOf("}");
            if (jsonStart !== -1 && jsonEnd !== -1) {
              const jsonString = historyText.substring(jsonStart, jsonEnd + 1);
              historyData = JSON.parse(jsonString);
            }
          }

          if (historyData && historyData.table && historyData.table.rows) {
            processedHistoryData = historyData.table.rows
              .map((row, rowIndex) => {
                if (rowIndex === 0) return null;

                const rowData = {
                  _id: Math.random().toString(36).substring(2, 15),
                  _rowIndex: rowIndex + 2,
                };

                const rowValues = row.c
                  ? row.c.map((cell) =>
                    cell && cell.v !== undefined ? cell.v : ""
                  )
                  : [];

                // Map all columns including column H (col7) for user filtering and column I (col8) for Task
                rowData["col0"] = rowValues[0]
                  ? parseGoogleSheetsDate(String(rowValues[0]))
                  : "";
                rowData["col1"] = rowValues[1] || "";
                rowData["col2"] = rowValues[2] || "";
                rowData["col3"] = rowValues[3] || "";
                rowData["col4"] = rowValues[4] || "";
                rowData["col5"] = rowValues[5] || "";
                rowData["col6"] = rowValues[6] || "";
                rowData["col7"] = rowValues[7] || ""; // Column H - User name
                rowData["col8"] = rowValues[8] || ""; // Column I - Task
                rowData["col9"] = rowValues[9] || ""; // Column J - Given By

                return rowData;
              })
              .filter((row) => row !== null);
          }
        } catch (historyError) {
          console.error("Error processing history data:", historyError);
        }
      }

      setHistoryData(processedHistoryData);

      // Process main delegation data - REMOVED DATE FILTERING
      const currentUsername = sessionStorage.getItem("username");
      const currentUserRole = sessionStorage.getItem("role");

      const pendingAccounts = [];

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
        if (rowIndex === 0) return; // Skip header row

        let rowValues = [];
        if (row.c) {
          rowValues = row.c.map((cell) =>
            cell && cell.v !== undefined ? cell.v : ""
          );
        } else if (Array.isArray(row)) {
          rowValues = row;
        } else {
          return;
        }

        const assignedTo = rowValues[4] || t('delegation.unassigned');
        const isUserMatch =
          currentUserRole === "admin" ||
          assignedTo.toLowerCase() === currentUsername.toLowerCase();
        if (!isUserMatch && currentUserRole !== "admin") return;

        // Check conditions: Column K not null and Column L null
        const columnKValue = rowValues[10];
        const columnLValue = rowValues[11];

        const hasColumnK = !isEmpty(columnKValue);
        const isColumnLEmpty = isEmpty(columnLValue);

        if (!hasColumnK || !isColumnLEmpty) {
          return;
        }

        // REMOVED DATE FILTERING - Show all data regardless of date

        const googleSheetsRowIndex = rowIndex + 1;
        const taskId = rowValues[1] || "";
        const stableId = taskId
          ? `task_${taskId}_${googleSheetsRowIndex}`
          : `row_${googleSheetsRowIndex}_${Math.random()
            .toString(36)
            .substring(2, 15)}`;

        const rowData = {
          _id: stableId,
          _rowIndex: googleSheetsRowIndex,
          _taskId: taskId,
        };

        // Map all columns
        for (let i = 0; i < 18; i++) {
          if (i === 0 || i === 6 || i === 10) {
            rowData[`col${i}`] = rowValues[i]
              ? parseGoogleSheetsDate(String(rowValues[i]))
              : "";
          } else {
            rowData[`col${i}`] = rowValues[i] || "";
          }
        }

        pendingAccounts.push(rowData);
      });

      setAccountData(pendingAccounts);
      setLoading(false);
    } catch (error) {
      console.error("Error fetching sheet data:", error);
      setError("Failed to load account data: " + error.message);
      setLoading(false);
    }
  }, [
    formatDateToDDMMYYYY,
    parseGoogleSheetsDate,
    parseDateFromDDMMYYYY,
    isEmpty,
  ]);

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
          actualDate: item["col0"] || "",
          status: item["col2"] || "",
          remarks: item["col4"] || "",
          imageUrl: item["col5"] || "",
          columnKValue: "DONE", // Column K में "DONE" submit hoga
        };
      });

      const formData = new FormData();
      formData.append("sheetName", CONFIG.TARGET_SHEET_NAME);
      formData.append("action", "updateDelegationData");
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
              ? { ...item, col10: "DONE" }
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
      const dateForSubmission = formatDateForGoogleSheets(today);

      await Promise.all(
        selectedItemsArray.map(async (id) => {
          const item = accountData.find((account) => account._id === id);

          const whatsappRowData = [
            dateForSubmission.formatted, // Time Stamp (Column A)
            item["col1"] || "", // Task ID (Column B)
            "Delegation", // Stage (Column C) - Fixed
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

  const handleSelectItem = useCallback((id, isChecked) => {
    setSelectedItems((prev) => {
      const newSelected = new Set(prev);

      if (isChecked) {
        newSelected.add(id);
        setStatusData((prevStatus) => ({ ...prevStatus, [id]: "Done" }));
      } else {
        newSelected.delete(id);
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
        setStatusData((prevStatus) => {
          const newStatusData = { ...prevStatus };
          delete newStatusData[id];
          return newStatusData;
        });
        setNextTargetDate((prevDate) => {
          const newDateData = { ...prevDate };
          delete newDateData[id];
          return newDateData;
        });
      }

      return newSelected;
    });
  }, []);

  const handleCheckboxClick = useCallback(
    (e, id) => {
      e.stopPropagation();
      const isChecked = e.target.checked;
      handleSelectItem(id, isChecked);
    },
    [handleSelectItem]
  );

  const handleSelectAllItems = useCallback(
    (e) => {
      e.stopPropagation();
      const checked = e.target.checked;

      if (checked) {
        const allIds = filteredAccountData.map((item) => item._id);
        setSelectedItems(new Set(allIds));

        const newStatusData = {};
        allIds.forEach((id) => {
          newStatusData[id] = "Done";
        });
        setStatusData((prev) => ({ ...prev, ...newStatusData }));
      } else {
        setSelectedItems(new Set());
        setAdditionalData({});
        setRemarksData({});
        setStatusData({});
        setNextTargetDate({});
      }
    },
    [filteredAccountData]
  );
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
            canPlay = true;
            checkReady();
          };

          video.onerror = (err) => {
            reject(err);
          };

          setTimeout(() => {
            if (!metadataLoaded || !canPlay) {
              reject(new Error("Video initialization timeout"));
            }
          }, 10000);
        });

        await videoRef.current.play();
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

  const handleImageUpload = useCallback(async (id, e) => {
    const file = e.target.files[0];
    if (!file) return;

    setAccountData((prev) =>
      prev.map((item) => (item._id === id ? { ...item, image: file } : item))
    );
  }, []);

  const handleStatusChange = useCallback((id, value) => {
    setStatusData((prev) => ({ ...prev, [id]: value }));
    if (value === "Done") {
      setNextTargetDate((prev) => {
        const newDates = { ...prev };
        delete newDates[id];
        return newDates;
      });
    }
  }, []);

  const handleNextTargetDateChange = useCallback((id, value) => {
    setNextTargetDate((prev) => ({ ...prev, [id]: value }));
  }, []);

  const fileToBase64 = useCallback((file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result);
      reader.onerror = (error) => reject(error);
    });
  }, []);

  const toggleHistory = useCallback(() => {
    setShowHistory((prev) => !prev);
    resetFilters();
  }, [resetFilters]);

  const handleSubmit = async () => {
    const selectedItemsArray = Array.from(selectedItems);

    if (selectedItemsArray.length === 0) {
      alert(t('delegation.selectAtLeastOneSubmit'));
      return;
    }

    const missingStatus = selectedItemsArray.filter((id) => !statusData[id]);
    if (missingStatus.length > 0) {
      alert(
        t('delegation.selectStatusForAll').replace('{count}', missingStatus.length)
      );
      return;
    }

    const missingNextDate = selectedItemsArray.filter(
      (id) => statusData[id] === "Extend date" && !nextTargetDate[id]
    );
    if (missingNextDate.length > 0) {
      alert(
        t('delegation.selectNextDateForExtend').replace('{count}', missingNextDate.length)
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
      // UPDATED: Use the new function to format date properly for Google Sheets
      const dateForSubmission = formatDateForGoogleSheets(today);

      // Process submissions in batches for better performance
      const batchSize = 5;
      for (let i = 0; i < selectedItemsArray.length; i += batchSize) {
        const batch = selectedItemsArray.slice(i, i + batchSize);

        await Promise.all(
          batch.map(async (id) => {
            const item = accountData.find((account) => account._id === id);
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

            // UPDATED: Use properly formatted date for submission
            // Format the next target date properly if it exists
            let formattedNextTargetDate = "";
            let nextTargetDateForGoogleSheets = null;

            if (nextTargetDate[id]) {
              const convertedDate = convertToGoogleSheetsDate(
                nextTargetDate[id]
              );
              formattedNextTargetDate = convertedDate.formatted;
              nextTargetDateForGoogleSheets = convertedDate.dateObject;
            }

            // Updated to include username in column H and task description in column I when submitting to history
            const newRowData = [
              dateForSubmission.formatted, // Use formatted date string
              item["col1"] || "",
              statusData[id] || "",
              formattedNextTargetDate, // Use properly formatted next target date
              remarksData[id] || "",
              imageUrl,
              "", // Column G
              username, // Column H - Store the logged-in username
              item["col5"] || "", // Column I - Task description from col5
              item["col3"] || "", // Column J - Given By from original task
            ];

            const insertFormData = new FormData();
            insertFormData.append("sheetName", CONFIG.TARGET_SHEET_NAME);
            insertFormData.append("action", "insert");
            insertFormData.append("rowData", JSON.stringify(newRowData));

            // UPDATED: Add comprehensive date format hints for Google Sheets
            insertFormData.append("dateFormat", "DD/MM/YYYY");
            insertFormData.append("timestampColumn", "0"); // Column A - Timestamp
            insertFormData.append("nextTargetDateColumn", "3"); // Column D - Next Target Date

            // Add additional metadata for proper date handling
            const dateMetadata = {
              columns: {
                0: { type: "date", format: "DD/MM/YYYY" }, // Timestamp
                3: { type: "date", format: "DD/MM/YYYY" }, // Next Target Date
              },
            };
            insertFormData.append("dateMetadata", JSON.stringify(dateMetadata));

            // If we have a proper date object for next target date, send it separately
            if (nextTargetDateForGoogleSheets) {
              insertFormData.append(
                "nextTargetDateObject",
                nextTargetDateForGoogleSheets.toISOString()
              );
            }

            return fetch(CONFIG.APPS_SCRIPT_URL, {
              method: "POST",
              body: insertFormData,
            });
          })
        );
      }

      setAccountData((prev) =>
        prev.filter((item) => !selectedItems.has(item._id))
      );

      setSuccessMessage(
        t('delegation.successfullyProcessed')
          .replace('{count}', selectedItemsArray.length)
          .replace('{sheetName}', CONFIG.TARGET_SHEET_NAME)
      );
      setSelectedItems(new Set());
      setAdditionalData({});
      setRemarksData({});
      setStatusData({});
      setNextTargetDate({});

      setTimeout(() => {
        fetchSheetData();
      }, 2000);
    } catch (error) {
      console.error("Submission error:", error);
      alert(t('delegation.failedSubmitRecords') + ": " + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedItemsCount = selectedItems.size;

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center gap-4 lg:gap-6 p-4 lg:p-0">
          {/* Page Title */}
          <h1 className="text-2xl lg:text-3xl font-bold tracking-tight text-purple-700 flex-shrink-0 order-1">
            {showHistory
              ? t(CONFIG.PAGE_CONFIG.historyTitle)
              : t(CONFIG.PAGE_CONFIG.title)}
          </h1>

          {/* Controls Section */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 w-full order-2 lg:order-2">
            {/* Search */}
            <div className="relative flex-1 sm:w-auto sm:flex-none min-w-0">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 pointer-events-none" size={18} />
              <input
                type="text"
                placeholder={showHistory ? t('delegation.searchByTaskId') : t('delegation.searchTasks')}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 border border-purple-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all duration-200 text-sm lg:text-base"
              />
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col lg:flex-row gap-2 lg:gap-3 w-full lg:w-auto order-3 lg:order-3 lg:ml-auto">
              {/* Toggle History Button */}
              <button
                onClick={toggleHistory}
                className="flex items-center justify-center px-4 py-2.5 text-sm font-medium rounded-lg bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all duration-200 shadow-sm hover:shadow-md text-white w-full lg:w-auto min-w-[120px]"
              >
                {showHistory ? (
                  <>
                    <ArrowLeft className="h-4 w-4 mr-1 flex-shrink-0" />
                    {t('delegation.backToTasks')}
                  </>
                ) : (
                  <>
                    <History className="h-4 w-4 mr-1 flex-shrink-0" />
                    {t('delegation.viewHistory')}
                  </>
                )}
              </button>

              {/* History Submit Button */}
              {showHistory && selectedHistoryItems.size > 0 && (
                <button
                  onClick={handleSubmitHistoryDone}
                  disabled={isSubmittingHistory}
                  className="flex items-center justify-center px-4 py-2.5 text-sm font-medium rounded-lg bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-sm hover:shadow-md text-white w-full lg:w-auto min-w-[140px]"
                >
                  {isSubmittingHistory ? (
                    <span className="flex items-center">
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      {t('delegation.processing')}
                    </span>
                  ) : (
                    t('delegation.doneWithCount').replace('{count}', selectedHistoryItems.size)
                  )}
                </button>
              )}

              {/* Task Submit Buttons (Non-History) */}
              {!showHistory && (
                <>
                  <button
                    onClick={handleSubmit}
                    disabled={selectedItemsCount === 0 || isSubmitting}
                    className="flex items-center justify-center px-4 py-2.5 text-sm font-medium rounded-lg bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-sm hover:shadow-md text-white w-full lg:w-auto min-w-[140px]"
                  >
                    {isSubmitting ? (
                      <span className="flex items-center">
                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        {t('delegation.processing')}
                      </span>
                    ) : (
                      t('delegation.submitWithCount').replace('{count}', selectedItemsCount)
                    )}
                  </button>

                  <button
                    onClick={handleWhatsAppSubmit}
                    disabled={selectedItemsCount === 0 || isSubmittingWhatsApp}
                    className="flex items-center justify-center px-4 py-2.5 text-sm font-medium rounded-lg bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-sm hover:shadow-md text-white w-full lg:w-auto min-w-[140px]"
                  >
                    {isSubmittingWhatsApp ? (
                      <span className="flex items-center">
                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        {t('delegation.sending')}
                      </span>
                    ) : (
                      <>
                        <svg className="h-4 w-4 mr-1 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.75 1.676 3.372.512.622 1.258 1.198 1.528 1.398.278.199.651.235.944.083.296-.152.581-.462.81-.918.23-.455.501-.782 1.042-.952.541-.17 1.501-.229 2.217-.256.72-.027 1.72-.114 2.228-.362.508-.248 1.22-.68 1.22-1.536 0-.595-.416-1.136-.963-1.371zm-5.472 6.618h-10c-1.104 0-2-.896-2-2v-14c0-1.104.896-2 2-2h14c1.104 0 2 .896 2 2v14c0 1.104-.896 2-2 2z" />
                        </svg>
                        {t('delegation.whatsappWithCount').replace('{count}', selectedItemsCount)}
                      </>
                    )}
                  </button>
                </>
              )}
            </div>
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
                ? t('delegation.historyTitle')
                : t('delegation.pendingTasks')}
            </h2>
            <p className="text-purple-600 text-sm">
              {showHistory
                ? t('delegation.historyDescription')
                : t('delegation.pendingDescription')}
            </p>
          </div>

          {loading ? (
            <div className="text-center py-10">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-purple-500 mb-4"></div>
              <p className="text-purple-600">{t('common.loading')}</p>
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
              {/* Simplified History Filters - Only Date Range */}
              <div className="p-4 border-b border-purple-100 bg-gray-50">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="flex flex-col">
                    <div className="mb-2 flex items-center">
                      <span className="text-sm font-medium text-purple-700">
                        {t('common.filterByDate')}:
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center">
                        <label
                          htmlFor="start-date"
                          className="text-sm text-gray-700 mr-1"
                        >
                          {t('common.from')}
                        </label>
                        <input
                          id="start-date"
                          type="date"
                          value={startDate}
                          onChange={(e) => setStartDate(e.target.value)}
                          className="text-sm border border-gray-200 rounded-md p-1"
                        />
                      </div>
                      <div className="flex items-center">
                        <label
                          htmlFor="end-date"
                          className="text-sm text-gray-700 mr-1"
                        >
                          {t('common.to')}
                        </label>
                        <input
                          id="end-date"
                          type="date"
                          value={endDate}
                          onChange={(e) => setEndDate(e.target.value)}
                          className="text-sm border border-gray-200 rounded-md p-1"
                        />
                      </div>
                    </div>
                  </div>

                  {(startDate || endDate || searchTerm) && (
                    <button
                      onClick={resetFilters}
                      className="px-3 py-1 bg-red-100 text-red-700 rounded-md hover:bg-red-200 text-sm"
                    >
                      {t('common.clearAll')}
                    </button>
                  )}
                </div>
              </div>
              {/* History Table - Responsive */}
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
                              filteredHistoryData.filter((h) => h["col10"] !== "DONE").length > 0 &&
                              selectedHistoryItems.size ===
                              filteredHistoryData.filter((h) => h["col10"] !== "DONE").length
                            }
                            onChange={(e) => {
                              if (e.target.checked) {
                                const selectableIds = filteredHistoryData
                                  .filter((h) => h["col10"] !== "DONE")
                                  .map((h) => h._id);
                                setSelectedHistoryItems(new Set(selectableIds));
                              } else {
                                setSelectedHistoryItems(new Set());
                              }
                            }}
                          />
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('delegation.tableTimestamp')}</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('delegation.tableTaskId')}</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('delegation.tableTask')}</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('delegation.tableStatus')}</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('delegation.tableNextTargetDate')}</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('delegation.tableRemarks')}</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('delegation.tableUploadedImage')}</th>
                        {userRole === "admin" && (
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('delegation.tableUser')}</th>
                        )}
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('delegation.tableGivenBy')}</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {filteredHistoryData.length > 0 ? (
                        filteredHistoryData.map((history) => {
                          const isDone = history["col10"] === "DONE";
                          const isSelected = selectedHistoryItems.has(history._id);
                          return (
                            <tr key={history._id} className={`${isDone ? "bg-green-100" : isSelected ? "bg-purple-50" : ""} hover:bg-gray-50`}>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <input
                                  type="checkbox"
                                  className="h-4 w-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                                  checked={isSelected}
                                  disabled={isDone}
                                  onChange={(e) => handleHistoryCheckboxClick(e, history._id, history["col10"])}
                                />
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap"><div className="text-sm font-medium text-gray-900">{history["col0"] || "—"}</div></td>
                              <td className="px-6 py-4 whitespace-nowrap"><div className="text-sm text-gray-900">{history["col1"] || "—"}</div></td>
                              <td className="px-6 py-4 min-w-[250px]">
                                <div className="text-sm text-gray-900 max-w-md whitespace-normal break-words" title={history["col8"]}>
                                  {history["col8"] || "—"}
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${history["col2"] === "Done"
                                  ? "bg-green-100 text-green-800"
                                  : history["col2"] === "Extend date"
                                    ? "bg-yellow-100 text-yellow-800"
                                    : "bg-gray-100 text-gray-800"
                                  }`}>
                                  {history["col2"] || "—"}
                                </span>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="text-sm text-gray-900">{formatDateForDisplay(history["col3"]) || "—"}</div>
                              </td>
                              <td className="px-6 py-4 bg-purple-50 min-w-[200px]">
                                <div className="text-sm text-gray-900 max-w-md whitespace-normal break-words" title={history["col4"]}>
                                  {history["col4"] || "—"}
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                {history["col5"] ? (
                                  <a href={history["col5"]} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800 underline flex items-center">
                                    <img src={history["col5"] || "/api/placeholder/32/32"} alt="Attachment" className="h-8 w-8 object-cover rounded-md mr-2" />
                                    {t('delegation.view')}
                                  </a>
                                ) : (
                                  <span className="text-gray-400">{t('delegation.noAttachment')}</span>
                                )}
                              </td>
                              {userRole === "admin" && <td className="px-6 py-4 whitespace-nowrap"><div className="text-sm text-gray-900">{history["col7"] || "—"}</div></td>}
                              <td className="px-6 py-4 whitespace-nowrap"><div className="text-sm text-gray-900">{history["col9"] || "—"}</div></td>
                            </tr>
                          );
                        })
                      ) : (
                        <td colSpan={userRole === "admin" ? 10 : 9} className="px-6 py-4 text-center text-gray-500">
                          {searchTerm || startDate || endDate ? t('delegation.noHistoryFilters') : t('delegation.noCompletedFound')}
                        </td>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Card View */}
                <div className="lg:hidden space-y-4 p-4">
                  {filteredHistoryData.length > 0 ? (
                    filteredHistoryData.map((history) => {
                      const isDone = history["col10"] === "DONE";
                      const isSelected = selectedHistoryItems.has(history._id);
                      return (
                        <div
                          key={history._id}
                          className={`border rounded-xl p-6 shadow-sm ${isDone
                            ? "bg-green-50 border-green-200"
                            : isSelected
                              ? "bg-purple-50 border-purple-200 ring-2 ring-purple-200"
                              : "bg-white border-gray-200"
                            } hover:shadow-md transition-all duration-200`}
                        >
                          {/* Header with Checkbox & Task ID */}
                          <div className="flex items-start justify-between mb-4 pb-4 border-b border-gray-100">
                            <div className="flex items-center space-x-3 flex-1 min-w-0">
                              <input
                                type="checkbox"
                                className="h-5 w-5 rounded border-gray-300 text-purple-600 focus:ring-purple-500 mt-0.5 flex-shrink-0"
                                checked={isSelected}
                                disabled={isDone}
                                onChange={(e) => handleHistoryCheckboxClick(e, history._id, history["col10"])}
                              />
                              <div>
                                <div className="flex items-center space-x-2 mb-1">
                                  <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs font-semibold">
                                    #{history["col1"] || "—"}
                                  </span>
                                  <span className={`px-2 py-1 rounded-full text-xs font-semibold ${history["col2"] === "Done"
                                    ? "bg-green-100 text-green-800"
                                    : history["col2"] === "Extend date"
                                      ? "bg-yellow-100 text-yellow-800"
                                      : "bg-gray-100 text-gray-800"
                                    }`}>
                                    {history["col2"] || "—"}
                                  </span>
                                </div>
                                <h3 className="text-lg font-semibold text-gray-900 leading-tight line-clamp-2" title={history["col8"]}>
                                  {history["col8"] || "—"}
                                </h3>
                              </div>
                            </div>
                            {isDone && (
                              <div className="flex-shrink-0">
                                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                  ✅ DONE
                                </span>
                              </div>
                            )}
                          </div>

                          {/* Main Details Grid */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                            <div className="space-y-2">
                              <span className="text-xs text-gray-500 font-medium">{t('delegation.timestamp')}</span>
                              <span className="text-sm font-medium text-gray-900">{history["col0"] || "—"}</span>
                            </div>
                            <div className="space-y-2">
                              <span className="text-xs text-gray-500 font-medium">{t('delegation.nextTarget')}</span>
                              <span className="text-sm text-gray-900 font-semibold">{formatDateForDisplay(history["col3"]) || "—"}</span>
                            </div>
                            <div className="space-y-2">
                              <span className="text-xs text-gray-500 font-medium">{t('assignTask.givenBy')}</span>
                              <span className="text-sm text-gray-900">{history["col9"] || "—"}</span>
                            </div>
                            {userRole === "admin" && (
                              <div className="space-y-2">
                                <span className="text-xs text-gray-500 font-medium">{t('common.user')}</span>
                                <span className="text-sm text-gray-900">{history["col7"] || "—"}</span>
                              </div>
                            )}
                          </div>

                          {/* Remarks Section */}
                          <div className="bg-purple-50 p-4 rounded-lg mb-6">
                            <span className="text-xs font-medium text-purple-800 block mb-2">{t('assignTask.remarks')}</span>
                            <p className="text-sm text-gray-900 leading-relaxed line-clamp-3" title={history["col4"]}>
                              {history["col4"] || "—"}
                            </p>
                          </div>

                          {/* Attachment Section */}
                          <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                            {history["col5"] ? (
                              <a
                                href={history["col5"]}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center text-blue-600 hover:text-blue-800 font-medium text-sm transition-colors"
                              >
                                <img
                                  src={history["col5"]}
                                  alt="Attachment"
                                  className="h-12 w-12 object-cover rounded-lg mr-3 flex-shrink-0 shadow-sm"
                                />
                                <span>{t('delegation.viewAttachment')}</span>
                              </a>
                            ) : (
                              <span className="text-sm text-gray-500">{t('delegation.noAttachment')}</span>
                            )}
                            <span className="text-xs text-gray-400">
                              {history["col0"] ? new Date(history["col0"]).toLocaleDateString() : "—"}
                            </span>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="text-center py-12 px-4">
                      <div className="text-gray-500 text-lg mb-4 max-w-md mx-auto">
                        {searchTerm || startDate || endDate
                          ? t('delegation.noHistoryFilters')
                          : t('delegation.noCompletedFound')}
                      </div>
                    </div>
                  )}
                </div>
              </div>

            </>
          ) : (
            /* Regular Tasks Table */
            <div className="overflow-x-auto">
              <div className="grid gap-4 sm:hidden">
                {filteredAccountData.length > 0 ? (
                  filteredAccountData.map((account) => {
                    const isSelected = selectedItems.has(account._id);
                    return (
                      <div
                        key={account._id}
                        className="p-4 border rounded-md shadow-sm bg-white relative"
                      >
                        {/* Row Select */}
                        <div className="absolute top-2 right-2">
                          <input
                            type="checkbox"
                            className="h-4 w-4 rounded border-gray-300 text-purple-600"
                            checked={isSelected}
                            onChange={(e) => handleCheckboxClick(e, account._id)}
                          />
                        </div>

                        <p><strong>{t('assignTask.taskId')}:</strong> {account.col1 || "—"}</p>
                        <p><strong>{t('assignTask.department')}:</strong> {account.col2 || "—"}</p>
                        <p><strong>{t('assignTask.givenBy')}:</strong> {account.col3 || "—"}</p>
                        <p><strong>{t('assignTask.name')}:</strong> {account.col4 || "—"}</p>
                        <p><strong>{t('assignTask.taskDescription')}:</strong> {account.col5 || "—"}</p>
                        <p><strong>{t('assignTask.startDate')}:</strong> {formatDateForDisplay(account.col6)}</p>
                        <p><strong>{t('assignTask.plannedDate')}:</strong> {formatDateForDisplay(account.col10)}</p>

                        {/* Status */}
                        <div className="mt-2">
                          <label className="text-sm font-semibold">{t('delegation.statusLabel')}</label>
                          <select
                            disabled={!isSelected}
                            value={statusData[account._id] || ""}
                            onChange={(e) =>
                              handleStatusChange(account._id, e.target.value)
                            }
                            className="border border-gray-300 rounded-md px-2 py-1 w-full"
                          >
                            <option value="">{t('common.select')}</option>
                            <option value="Done">{t('common.done')}</option>
                            <option value="Extend date">{t('delegation.extendDate')}</option>
                          </select>
                        </div>

                        {/* Next Target Date */}
                        <div className="mt-2">
                          <label className="text-sm font-semibold">{t('delegation.nextTargetDateLabel')}</label>
                          <input
                            type="date"
                            disabled={
                              !isSelected ||
                              statusData[account._id] !== "Extend date"
                            }
                            onChange={(e) => {
                              const inputDate = e.target.value;
                              if (inputDate) {
                                const [year, month, day] = inputDate.split("-");
                                const formattedDate = `${day}/${month}/${year}`;
                                handleNextTargetDateChange(account._id, formattedDate);
                              }
                            }}
                            className="border border-gray-300 rounded-md px-2 py-1 w-full"
                          />
                        </div>

                        {/* Remarks */}
                        <div className="mt-2">
                          <label className="text-sm font-semibold">{t('delegation.remarksLabel')}</label>
                          <input
                            type="text"
                            placeholder={t('delegation.enterRemarks')}
                            disabled={!isSelected}
                            value={remarksData[account._id] || ""}
                            onChange={(e) =>
                              setRemarksData((prev) => ({
                                ...prev,
                                [account._id]: e.target.value,
                              }))
                            }
                            className="border border-gray-300 rounded-md px-2 py-1 w-full"
                          />
                        </div>

                        {/* Upload Image + Camera Capture */}
                        <div className="mt-3 flex gap-3 flex-col">
                          <label
                            htmlFor={`upload-${account._id}`}
                            className={`cursor-pointer text-xs ${account.col9?.toUpperCase() === "YES"
                              ? "text-red-600 font-medium"
                              : "text-purple-600"
                              }`}
                          >
                            Upload Image{account.col9?.toUpperCase() === "YES" && <span className="text-red-500">*</span>}
                          </label>
                          <input
                            id={`upload-${account._id}`}
                            type="file"
                            className="hidden"
                            accept="image/*"
                            capture="environment"
                            onChange={(e) => handleImageUpload(account._id, e)}
                            disabled={!isSelected}
                          />

                          {/* 📸 Camera Button */}
                          <button
                            onClick={() => {
                              setCurrentCaptureId(account._id);
                              startCamera();
                            }}
                            disabled={!isSelected || isCameraLoading}
                            className="flex items-center gap-1 text-blue-600 text-xs disabled:opacity-50"
                          >
                            <Camera className="h-4 w-4" />
                            {isCameraLoading ? t('delegation.initializingCamera') : t('delegation.takePhoto')}
                          </button>
                        </div>

                      </div>
                    );
                  })
                ) : (
                  <p className="text-center text-gray-500">
                    {searchTerm ? t('common.noResults') : t('common.noData')}
                  </p>
                )}
              </div>

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
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {t('assignTask.taskId')}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {t('assignTask.department')}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {t('assignTask.givenBy')}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {t('assignTask.name')}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {t('assignTask.taskDescription')}
                    </th>
                    <th
                      className={`px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider ${!accountData["col17"] ? "bg-yellow-50" : ""
                        }`}
                    >
                      {t('assignTask.startDate')}
                    </th>
                    <th
                      className={`px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider ${!accountData["col17"] ? "bg-green-50" : ""
                        }`}
                    >
                      {t('assignTask.plannedDate')}
                    </th>
                    <th
                      className={`px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider ${!accountData["col17"] ? "bg-blue-50" : ""
                        }`}
                    >
                      {t('assignTask.status')}
                    </th>
                    <th
                      className={`px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider ${!accountData["col17"] ? "bg-indigo-50" : ""
                        }`}
                    >
                      {t('delegation.nextTargetDate')}
                    </th>
                    <th
                      className={`px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider ${!accountData["col17"] ? "bg-purple-50" : ""
                        }`}
                    >
                      {t('assignTask.remarks')}
                    </th>
                    <th
                      className={`px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider ${!accountData["col17"] ? "bg-orange-50" : ""
                        }`}
                    >
                      {t('delegation.uploadImage')}
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredAccountData.length > 0 ? (
                    filteredAccountData.map((account) => {
                      const isSelected = selectedItems.has(account._id);
                      const rowColorClass = getRowColor(account["col17"]);
                      return (
                        <tr
                          key={account._id}
                          className={`${isSelected ? "bg-purple-50" : ""
                            } hover:bg-gray-50 ${rowColorClass}`}
                        >
                          <td className="px-6 py-4 whitespace-nowrap">
                            <input
                              type="checkbox"
                              className="h-4 w-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                              checked={isSelected}
                              onChange={(e) =>
                                handleCheckboxClick(e, account._id)
                              }
                            />
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900">
                              {account["col1"] || "—"}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900">
                              {account["col2"] || "—"}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900">
                              {account["col3"] || "—"}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900">
                              {account["col4"] || "—"}
                            </div>
                          </td>
                          <td className="px-6 py-4 min-w-[250px]">
                            <div
                              className="text-sm text-gray-900 max-w-md whitespace-normal break-words"
                              title={account["col5"]}
                            >
                              {account["col5"] || "—"}
                            </div>
                          </td>
                          <td
                            className={`px-6 py-4 whitespace-nowrap ${!account["col17"] ? "bg-yellow-50" : ""
                              }`}
                          >
                            <div className="text-sm text-gray-900">
                              {formatDateForDisplay(account["col6"])}
                            </div>
                          </td>
                          <td
                            className={`px-6 py-4 whitespace-nowrap ${!account["col17"] ? "bg-green-50" : ""
                              }`}
                          >
                            <div className="text-sm text-gray-900">
                              {formatDateForDisplay(account["col10"])}
                            </div>
                          </td>
                          <td
                            className={`px-6 py-4 whitespace-nowrap ${!account["col17"] ? "bg-blue-50" : ""
                              }`}
                          >
                            <select
                              disabled={!isSelected}
                              value={statusData[account._id] || ""}
                              onChange={(e) =>
                                handleStatusChange(account._id, e.target.value)
                              }
                              className="border border-gray-300 rounded-md px-2 py-1 w-full disabled:bg-gray-100 disabled:cursor-not-allowed"
                            >
                              <option value="">{t('common.select')}</option>
                              <option value="Done">{t('common.done')}</option>
                              <option value="Extend date">{t('delegation.extendDate')}</option>
                            </select>
                          </td>
                          <td
                            className={`px-6 py-4 whitespace-nowrap ${!account["col17"] ? "bg-indigo-50" : ""
                              }`}
                          >
                            <input
                              type="date"
                              disabled={
                                !isSelected ||
                                statusData[account._id] !== "Extend date"
                              }
                              value={
                                nextTargetDate[account._id]
                                  ? (() => {
                                    const dateStr =
                                      nextTargetDate[account._id];
                                    if (dateStr && dateStr.includes("/")) {
                                      const [day, month, year] =
                                        dateStr.split("/");
                                      return `${year}-${month.padStart(
                                        2,
                                        "0"
                                      )}-${day.padStart(2, "0")}`;
                                    }
                                    return dateStr;
                                  })()
                                  : ""
                              }
                              onChange={(e) => {
                                const inputDate = e.target.value;
                                if (inputDate) {
                                  const [year, month, day] =
                                    inputDate.split("-");
                                  const formattedDate = `${day}/${month}/${year}`;
                                  handleNextTargetDateChange(
                                    account._id,
                                    formattedDate
                                  );
                                } else {
                                  handleNextTargetDateChange(account._id, "");
                                }
                              }}
                              className="border border-gray-300 rounded-md px-2 py-1 w-full disabled:bg-gray-100 disabled:cursor-not-allowed"
                            />
                          </td>
                          <td
                            className={`px-6 py-4 whitespace-nowrap ${!account["col17"] ? "bg-purple-50" : ""
                              }`}
                          >
                            <input
                              type="text"
                              placeholder={t('form.enterValue')}
                              disabled={!isSelected}
                              value={remarksData[account._id] || ""}
                              onChange={(e) =>
                                setRemarksData((prev) => ({
                                  ...prev,
                                  [account._id]: e.target.value,
                                }))
                              }
                              className="border rounded-md px-2 py-1 w-full border-gray-300 disabled:bg-gray-100 disabled:cursor-not-allowed"
                            />
                          </td>
                          <td
                            className={`px-6 py-4 whitespace-nowrap ${!account["col17"] ? "bg-orange-50" : ""
                              }`}
                          >
                            {account.image ? (
                              <div className="flex items-center">
                                <img
                                  src={
                                    typeof account.image === "string"
                                      ? account.image
                                      : URL.createObjectURL(account.image)
                                  }
                                  alt="Receipt"
                                  className="h-10 w-10 object-cover rounded-md mr-2"
                                />
                                <div className="flex flex-col">
                                  <span className="text-xs text-gray-500">
                                    {account.image instanceof File
                                      ? account.image.name
                                      : "Uploaded Receipt"}
                                  </span>
                                  {account.image instanceof File ? (
                                    <span className="text-xs text-green-600">
                                      {t('delegation.readyToUpload')}
                                    </span>
                                  ) : (
                                    <button
                                      className="text-xs text-purple-600 hover:text-purple-800"
                                      onClick={() =>
                                        window.open(account.image, "_blank")
                                      }
                                    >
                                      {t('delegation.viewFullImage')}
                                    </button>
                                  )}
                                </div>
                              </div>
                            ) : (
                              <div className="flex flex-col gap-2">
                                {/* File Upload Button */}
                                <label
                                  htmlFor={`upload-${account._id}`}
                                  className={`flex items-center cursor-pointer ${account["col9"]?.toUpperCase() === "YES"
                                    ? "text-red-600 font-medium"
                                    : "text-purple-600"
                                    } hover:text-purple-800`}
                                >
                                  <Upload className="h-4 w-4 mr-1" />
                                  <span className="text-xs">
                                    {account["col9"]?.toUpperCase() === "YES"
                                      ? t('delegation.requiredUpload')
                                      : t('delegation.uploadImage')}
                                    {account["col9"]?.toUpperCase() ===
                                      "YES" && (
                                        <span className="text-red-500 ml-1">
                                          *
                                        </span>
                                      )}
                                  </span>
                                </label>

                                <input
                                  id={`upload-${account._id}`}
                                  type="file"
                                  className="hidden"
                                  accept="image/*"
                                  capture="environment"
                                  onChange={(e) =>
                                    handleImageUpload(account._id, e)
                                  }
                                  disabled={!isSelected}
                                />

                                {/* Camera Capture Button */}
                                <button
                                  onClick={() => {
                                    setCurrentCaptureId(account._id);
                                    startCamera();
                                  }}
                                  disabled={!isSelected || isCameraLoading}
                                  className="flex items-center text-blue-600 hover:text-blue-800 text-xs disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  <Camera className="h-4 w-4 mr-1" />
                                  <span>
                                    {isCameraLoading
                                      ? t('common.loading')
                                      : t('delegation.takePhoto')}
                                  </span>
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td
                        colSpan={12}
                        className="px-6 py-4 text-center text-gray-500"
                      >
                        {searchTerm
                          ? t('common.noResults')
                          : t('common.noData')}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
        {isCameraOpen && (
          <div className="fixed inset-0 bg-black bg-opacity-75 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full overflow-hidden">
              <div className="bg-blue-600 text-white px-4 py-3 flex items-center justify-between">
                <h3 className="text-lg font-semibold">📸 {t('delegation.takePhoto')}</h3>
                <button
                  onClick={stopCamera}
                  className="text-white hover:text-gray-200 transition-colors"
                  aria-label={t('common.close')}
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
                      <p>{t('common.loading')}...</p>
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

export default DelegationDataPage;
