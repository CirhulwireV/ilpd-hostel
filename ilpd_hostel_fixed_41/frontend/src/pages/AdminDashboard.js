import React, { useEffect, useState, useCallback } from "react";
import API from "../api/axios";

const TABS = ["Overview", "Reports", "Bookings", "Rooms", "Clients", "Guest Support", "Surveys"];

function PriceEditor({ room, onSave }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(room.price);
  
  useEffect(() => { 
    setValue(room.price); 
  }, [room.price]);
  
  if (!editing) {
    return (
      <button 
        type="button" 
        onClick={() => setEditing(true)} 
        style={{ 
          background: "none", 
          border: "none", 
          padding: 0, 
          cursor: "pointer", 
          fontWeight: "700", 
          textDecoration: "underline dotted", 
          color: "inherit" 
        }} 
        title="Click to change price"
      >
        {Number(room.price || 0).toLocaleString()} RWF
      </button>
    );
  }
  
  return (
    <div style={{ display: "flex", gap: "4px", alignItems: "center" }}>
      <input 
        type="number" 
        min="1" 
        value={value} 
        onChange={(e) => setValue(e.target.value)} 
        style={{ width: "90px", marginBottom: 0, fontSize: "13px" }} 
        autoFocus 
      />
      <button 
        className="btn btn-primary" 
        style={{ padding: "4px 8px", fontSize: "12px" }} 
        onClick={() => { 
          onSave(room._id, value); 
          setEditing(false); 
        }}
      >
        Save
      </button>
      <button 
        className="btn btn-secondary" 
        style={{ padding: "4px 8px", fontSize: "12px" }} 
        onClick={() => { 
          setValue(room.price); 
          setEditing(false); 
        }}
      >
        ✕
      </button>
    </div>
  );
}

const fmt = (n) => `${Number(n || 0).toLocaleString()} RWF`;

const STATUS_COLORS = {
  pending: { bg: "#fefcbf", color: "#744210" },
  confirmed: { bg: "#c6f6d5", color: "#276749" },
  "checked-in": { bg: "#bee3f8", color: "#2a69ac" },
  "checked-out": { bg: "#e2e8f0", color: "#4a5568" },
  cancelled: { bg: "#fed7d7", color: "#9b2c2c" },
  rejected: { bg: "#fed7d7", color: "#9b2c2c" },
};

export default function AdminDashboard() {
  // ============ STATE DECLARATIONS ============
  const [confirmDialog, setConfirmDialog] = useState(null);
  const [tab, setTab] = useState("Overview");
  const [bookingSubTab, setBookingSubTab] = useState("Waiting List");
  const [highlightBookingId, setHighlightBookingId] = useState(null);
  const [bookingsShown, setBookingsShown] = useState(25);
  const [bookings, setBookings] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [clients, setClients] = useState([]);
  const [concerns, setConcerns] = useState([]);
  const [surveys, setSurveys] = useState([]);
  const [concernRoomFilter, setConcernRoomFilter] = useState("");
  const [newBlockName, setNewBlockName] = useState("");
  const [newBlockType, setNewBlockType] = useState("outside_hostel");
  const [blockMsg, setBlockMsg] = useState("");
  const [healthChecking, setHealthChecking] = useState(false);
  const [healthResult, setHealthResult] = useState(null);
  const [knownBlocks, setKnownBlocks] = useState([]);
  const [blocks, setBlocks] = useState([]);
  const [categories, setCategories] = useState([]);
  const [structureMsg, setStructureMsg] = useState("");
  const [structureError, setStructureError] = useState("");
  const [blockForm, setBlockForm] = useState({ 
    name: "", 
    accommodationType: "outside_hostel", 
    usesCategories: true, 
    description: "" 
  });
  const [editingBlock, setEditingBlock] = useState(null);
  const [expandedBlock, setExpandedBlock] = useState(null);
  const [subBlockForm, setSubBlockForm] = useState({});
  const [subBlockParent, setSubBlockParent] = useState("");
  const [editingSubBlock, setEditingSubBlock] = useState(null);
  const [editingSubBlockParent, setEditingSubBlockParent] = useState("");
  const [subBlockName, setSubBlockName] = useState("");
  const [catForm, setCatForm] = useState({ 
    name: "", 
    price: "", 
    description: "", 
    capacity: 2 
  });
  const [editingCat, setEditingCat] = useState(null);
  const [editingRoom, setEditingRoom] = useState(null);
  const [editRoomForm, setEditRoomForm] = useState({});
  const [editRoomError, setEditRoomError] = useState("");
  const [editRoomSaving, setEditRoomSaving] = useState(false);
  const [reallocatingId, setReallocatingId] = useState(null);
  const [reallocateRoomId, setReallocateRoomId] = useState("");
  const [reallocateRooms, setReallocateRooms] = useState([]);
  const [surveyQuestions, setSurveyQuestions] = useState([]);
  const [newSurveyQuestion, setNewSurveyQuestion] = useState("");
  const [surveyQuestionMsg, setSurveyQuestionMsg] = useState("");
  const [clientMsg, setClientMsg] = useState("");
  const [clientError, setClientError] = useState("");
  const [showStructure, setShowStructure] = useState(false);
  const [msg, setMsg] = useState("");
  const [search, setSearch] = useState("");
  const [responseText, setResponseText] = useState({});
  const [responseMsg, setResponseMsg] = useState("");
  const [responseError, setResponseError] = useState("");
  const [bookingMsg, setBookingMsg] = useState("");
  const [bookingError, setBookingError] = useState("");
  const [weeklyReport, setWeeklyReport] = useState(null);
  const [monthlyReport, setMonthlyReport] = useState(null);
  const [monthlyReportError, setMonthlyReportError] = useState("");
  const [monthlyReportMonth, setMonthlyReportMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const [reportError, setReportError] = useState("");
  const [allocatingId, setAllocatingId] = useState(null);
  const [allocateRoomId, setAllocateRoomId] = useState([]);
  const [allocationRooms, setAllocationRooms] = useState([]);
  const [showAddRoom, setShowAddRoom] = useState(false);
  const [newRoom, setNewRoom] = useState({ 
    roomNumber: "", 
    category: "", 
    accommodationType: "outside_hostel", 
    hostelSection: "", 
    price: "", 
    address: "Nyanza, Southern Province, Rwanda", 
    images: [], 
    imageData: "", 
    imageName: "" 
  });
  const [addRoomError, setAddRoomError] = useState("");
  const [addingRoom, setAddingRoom] = useState(false);
  const [bulkMode, setBulkMode] = useState(false);
  const [bulkRoomNumbers, setBulkRoomNumbers] = useState("");
  const [bulkStartNumber, setBulkStartNumber] = useState("");
  const [bulkCount, setBulkCount] = useState("5");
  const [bulkCreating, setBulkCreating] = useState(false);

  const currentUserId = (() => {
    try { 
      return JSON.parse(localStorage.getItem("user"))?._id || JSON.parse(localStorage.getItem("user"))?.id; 
    } catch { 
      return null; 
    }
  })();

  // ============ HELPER FUNCTIONS ============
  const askConfirm = useCallback((message, onConfirm) => {
    setConfirmDialog({ message, onConfirm });
  }, []);

  // ============ REFRESH FUNCTIONS ============
  const refreshRooms = useCallback(async () => {
    try {
      const { data } = await API.get("/rooms");
      setRooms(data);
    } catch (_) {}
  }, []);

  const refreshStructure = useCallback(async () => {
    try {
      setStructureMsg("");
      setStructureError("");
      
      const [blocksRes, categoriesRes] = await Promise.all([
        API.get("/hostel-structure/blocks?activeOnly=false"),
        API.get("/hostel-structure/categories?activeOnly=false"),
      ]);
      
      setBlocks(blocksRes.data || []);
      setCategories(categoriesRes.data || []);
    } catch (err) {
      setStructureError(err.response?.data?.message || "Could not load hostel structure.");
      console.error("Refresh structure error:", err);
    }
  }, []);

  // ============ DELETE ROOM FUNCTION ============
  const deleteRoom = useCallback(async (id) => {
    askConfirm("Delete this room permanently? This cannot be undone.", async () => {
      try {
        await API.delete(`/rooms/${id}`);
        setRooms((prev) => prev.filter((r) => r._id !== id));
        setMsg("Room deleted successfully.");
        await refreshRooms();
      } catch (err) {
        setAddRoomError(err.response?.data?.message || "Could not delete room.");
      }
    });
  }, [askConfirm, refreshRooms]);

  // ============ UPDATE ROOM STATUS ============
  const updateRoomStatus = useCallback(async (id, status) => {
    try {
      const { data } = await API.put(`/rooms/${id}`, { status });
      setRooms((prev) => prev.map((r) => (r._id === id ? data : r)));
      setAddRoomError("");
    } catch (err) {
      setAddRoomError(err.response?.data?.message || "Unable to update room status.");
    }
  }, []);

  // ============ UPDATE ROOM PRICE ============
  const updateRoomPrice = useCallback(async (id, price) => {
    const numericPrice = Number(price);
    if (!Number.isFinite(numericPrice) || numericPrice <= 0) return;
    try {
      const { data } = await API.put(`/rooms/${id}`, { price: numericPrice });
      setRooms((prev) => prev.map((r) => (r._id === id ? data : r)));
      setMsg(`Room ${data.roomNumber} price updated.`);
    } catch (err) {
      setAddRoomError(err.response?.data?.message || "Unable to update price.");
    }
  }, []);

  // ============ CHECK ROOM HEALTH ============
  const checkRoomHealth = useCallback(async (dryRun) => {
    setHealthChecking(true);
    try {
      const { data } = await API.post(`/rooms/health-check?dryRun=${dryRun}`);
      setHealthResult(data);
      if (!dryRun) await refreshRooms();
    } catch (err) {
      setHealthResult({ 
        message: err.response?.data?.message || "Could not check room health.", 
        duplicateGroupsFound: 0 
      });
    } finally {
      setHealthChecking(false);
    }
  }, [refreshRooms]);

  // ============ IMAGE UPLOAD ============
  const uploadRoomPhotosToCloudinary = useCallback(async (imageDataUrls) => {
    if (!imageDataUrls?.length) return [];
    
    const formData = new FormData();
    
    imageDataUrls.forEach((imageData, index) => {
      const [header, base64] = imageData.split(",");
      const mimeType = header.match(/^data:(image\/(?:jpeg|png|webp));base64$/)?.[1];
      if (!mimeType || !base64) throw new Error("One of the selected images is invalid.");
      
      const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
      const extension = mimeType === "image/jpeg" ? "jpg" : mimeType.split("/")[1];
      formData.append("images", new File([bytes], `room-${index + 1}.${extension}`, { type: mimeType }));
    });
    
    const { data } = await API.post("/upload/rooms/images", formData);
    return data.images;
  }, []);

  // ============ CREATE ROOM ============
  const createRoom = useCallback(async (e) => {
    e.preventDefault();
    setAddRoomError("");
    
    if (!newRoom.roomNumber.trim()) {
      setAddRoomError("Room number is required.");
      return;
    }
    if (!newRoom.hostelSection) {
      setAddRoomError("Select a block.");
      return;
    }
    if (!newRoom.category) {
      setAddRoomError("Create and select a category first.");
      return;
    }
    if (!newRoom.price || Number(newRoom.price) <= 0) {
      setAddRoomError("Enter a price greater than 0.");
      return;
    }
    if (!newRoom.address.trim()) {
      setAddRoomError("Enter the location.");
      return;
    }
    
    setAddingRoom(true);
    try {
      const images = await uploadRoomPhotosToCloudinary(newRoom.images);
      const { data } = await API.post("/rooms", {
        roomNumber: newRoom.roomNumber.trim(),
        category: newRoom.category,
        accommodationType: newRoom.accommodationType,
        hostelSection: newRoom.hostelSection || undefined,
        price: Number(newRoom.price),
        address: newRoom.address,
        images,
      });
      setRooms((prev) => [...prev, data].sort((a, b) => a.roomNumber.localeCompare(b.roomNumber)));
      setMsg(`Room ${data.roomNumber} created successfully.`);
      API.get("/rooms/blocks").then(({ data: b }) => setKnownBlocks(b)).catch(() => {});
      setNewRoom({ 
        roomNumber: "", 
        category: "", 
        accommodationType: "outside_hostel", 
        hostelSection: "", 
        price: "", 
        address: "Nyanza, Southern Province, Rwanda", 
        images: [], 
        imageData: "", 
        imageName: "" 
      });
      setShowAddRoom(false);
    } catch (err) {
      setAddRoomError(err.response?.data?.message || "Could not create room.");
    } finally {
      setAddingRoom(false);
    }
  }, [newRoom, uploadRoomPhotosToCloudinary]);

  // ============ CREATE BULK ROOMS ============
  const createBulkRooms = useCallback(async () => {
    setAddRoomError("");
    
    if (!newRoom.price || Number(newRoom.price) <= 0) {
      setAddRoomError("Enter a price greater than 0.");
      return;
    }
    if (!newRoom.address.trim()) {
      setAddRoomError("Enter the location.");
      return;
    }
    if (!newRoom.hostelSection) {
      setAddRoomError("Select a block.");
      return;
    }
    if (!newRoom.category) {
      setAddRoomError("Create and select a category first.");
      return;
    }
    
    setBulkCreating(true);
    try {
      const numbers = bulkRoomNumbers.split(",").map((n) => n.trim()).filter(Boolean);
      const images = await uploadRoomPhotosToCloudinary(newRoom.images);
      const payload = {
        category: newRoom.category,
        accommodationType: newRoom.accommodationType,
        hostelSection: newRoom.hostelSection || undefined,
        price: Number(newRoom.price),
        address: newRoom.address,
        images,
      };
      
      if (numbers.length) {
        payload.roomNumbers = numbers;
      } else {
        if (!bulkStartNumber || !bulkCount) {
          setAddRoomError("Enter a starting room number and the number of rooms.");
          setBulkCreating(false);
          return;
        }
        payload.startNumber = Number(bulkStartNumber);
        payload.count = Number(bulkCount);
      }
      
      const { data } = await API.post("/rooms/bulk", payload);
      setRooms((prev) => [...prev, ...data.rooms].sort((a, b) => 
        a.roomNumber.localeCompare(b.roomNumber, undefined, { numeric: true })
      ));
      setMsg(`${data.count} rooms created successfully.`);
      API.get("/rooms/blocks").then(({ data: b }) => setKnownBlocks(b)).catch(() => {});
      setBulkRoomNumbers("");
      setBulkStartNumber("");
      setBulkCount("5");
      setNewRoom({ 
        roomNumber: "", 
        category: "", 
        accommodationType: "outside_hostel", 
        hostelSection: "", 
        price: "", 
        address: "Nyanza, Southern Province, Rwanda", 
        images: [], 
        imageData: "", 
        imageName: "" 
      });
      setShowAddRoom(false);
      setBulkMode(false);
    } catch (err) {
      setAddRoomError(err.response?.data?.message || "Unable to create rooms.");
    } finally {
      setBulkCreating(false);
    }
  }, [newRoom, bulkRoomNumbers, bulkStartNumber, bulkCount, uploadRoomPhotosToCloudinary]);

  // ============ JUMP TO BOOKING ============
  const jumpToBooking = useCallback((booking, subTab) => {
    setTab("Bookings");
    setBookingSubTab(subTab);
    setBookingsShown(9999);
    setHighlightBookingId(booking._id);
  }, []);

  // ============ RECORD CHECKIN ============
  const recordCheckin = useCallback((id) => {
    askConfirm("Record check-in now?", async () => {
      try {
        const { data } = await API.put(`/bookings/${id}/status`, { status: "checked-in" });
        setBookings((prev) => prev.map((b) => (b._id === id ? data : b)));
        setBookingMsg("Check-in recorded successfully.");
        setBookingError("");
        await refreshRooms();
        if (weeklyReport) {
          API.get("/bookings/report").then(({ data: report }) => setWeeklyReport(report)).catch(() => {});
        }
      } catch (err) {
        setBookingError(err.response?.data?.message || "Unable to record check-in.");
      }
    });
  }, [askConfirm, refreshRooms, weeklyReport]);

  // ============ RECORD CHECKOUT ============
  const recordCheckout = useCallback((id) => {
    askConfirm("Record checkout now?", async () => {
      try {
        const { data } = await API.put(`/bookings/${id}/status`, { status: "checked-out" });
        setBookings((prev) => prev.map((b) => (b._id === id ? data : b)));
        setBookingMsg("Checkout recorded.");
        setBookingError("");
        await refreshRooms();
        if (weeklyReport) {
          API.get("/bookings/report").then(({ data: report }) => setWeeklyReport(report)).catch(() => {});
        }
      } catch (err) {
        setBookingError(err.response?.data?.message || "Unable to record checkout.");
      }
    });
  }, [askConfirm, refreshRooms, weeklyReport]);

  // ============ BOOKING ALLOCATION ============
  const openAllocation = useCallback(async (booking) => {
    setBookingError("");
    setBookingMsg("");
    setAllocatingId(booking._id);
    setAllocateRoomId([]);
    try {
      const { data } = await API.get("/rooms/available-for-booking", {
        params: { 
          category: booking.category, 
          accommodationType: booking.accommodationType || "outside_hostel", 
          checkIn: booking.checkIn, 
          checkOut: booking.checkOut 
        },
      });
      setAllocationRooms(data);
      if (!data.length) setBookingError("No room is available for these booking dates.");
    } catch (err) {
      setAllocationRooms([]);
      setBookingError(err.response?.data?.message || "Unable to load available rooms.");
    }
  }, []);

  const allocateRoom = useCallback(async (id) => {
    if (!allocateRoomId.length) { 
      setBookingError("Please select the required number of rooms."); 
      return; 
    }
    try {
      const { data } = await API.put(`/bookings/${id}/allocate`, { roomIds: allocateRoomId });
      setBookings((prev) => prev.map((b) => (b._id === id ? data : b)));
      setAllocatingId(null);
      setAllocateRoomId([]);
      setBookingMsg("Room allocated successfully.");
      setBookingError("");
      await refreshRooms();
      if (weeklyReport) {
        API.get("/bookings/report").then(({ data }) => setWeeklyReport(data)).catch(() => {});
      }
    } catch (err) {
      setBookingError(err.response?.data?.message || "Unable to allocate room.");
    }
  }, [allocateRoomId, refreshRooms, weeklyReport]);

  // ============ CANCEL BOOKING ============
  const cancelBooking = useCallback(async (id) => {
    try {
      const { data } = await API.post(`/bookings/cancel/${id}`);
      setBookings((prev) => prev.filter((b) => b._id !== id));
      if (weeklyReport) {
        API.get("/bookings/report").then(({ data }) => setWeeklyReport(data)).catch(() => {});
      }
      setBookingMsg(data.message);
      setBookingError("");
      await refreshRooms();
    } catch (err) {
      setBookingError(err.response?.data?.message || "Unable to cancel booking.");
    }
  }, [refreshRooms, weeklyReport]);

  // ============ OPEN REALLOCATE ============
  const openReallocate = useCallback(async (booking) => {
    setBookingError("");
    setBookingMsg("");
    setReallocatingId(booking._id);
    setReallocateRoomId("");
    try {
      const { data } = await API.get("/rooms/available-for-booking", {
        params: { 
          category: booking.category, 
          accommodationType: booking.accommodationType || "outside_hostel", 
          checkIn: booking.checkIn, 
          checkOut: booking.checkOut 
        },
      });
      setReallocateRooms(data.filter((r) => String(r._id) !== String(booking.room?._id || booking.room)));
    } catch (err) {
      setReallocateRooms([]);
      setBookingError(err.response?.data?.message || "Unable to load available rooms.");
    }
  }, []);

  const confirmReallocate = useCallback(async (bookingId) => {
    if (!reallocateRoomId) { 
      setBookingError("Select a room."); 
      return; 
    }
    try {
      const { data } = await API.put(`/bookings/${bookingId}/reallocate`, { roomId: reallocateRoomId });
      setBookings((prev) => prev.map((b) => (b._id === bookingId ? data : b)));
      setReallocatingId(null);
      setReallocateRoomId("");
      setReallocateRooms([]);
      setBookingMsg("Room changed successfully.");
      await refreshRooms();
    } catch (err) {
      setBookingError(err.response?.data?.message || "Could not change room.");
    }
  }, [reallocateRoomId, refreshRooms]);

  // ============ CONCERN RESPONSE ============
  const updateConcernResponse = useCallback(async (id, currentResponse = "") => {
    setResponseMsg("");
    setResponseError("");
    const response = (responseText[id] ?? currentResponse)?.trim();
    if (!response) {
      setResponseError("Enter a response before submitting.");
      return;
    }
    try {
      const { data } = await API.put(`/concerns/${id}/respond`, { response });
      setConcerns((prev) => prev.map((c) => (c._id === id ? data : c)));
      setResponseMsg("Concern response saved successfully.");
      setResponseText((prev) => ({ ...prev, [id]: "" }));
    } catch (err) {
      setResponseError(err.response?.data?.message || "Unable to save response.");
    }
  }, [responseText]);

  // ============ SET CLIENT ROLE ============
  const setClientRole = useCallback(async (id, role, name) => {
    setClientError("");
    setClientMsg("");
    try {
      const { data } = await API.put(`/auth/clients/${id}/role`, { role });
      setClients((prev) => prev.map((c) => (c._id === id ? { ...c, role } : c)));
      setClientMsg(data.message);
    } catch (err) {
      setClientError(err.response?.data?.message || `Could not update ${name}'s role.`);
    }
  }, []);

  // ============ SURVEY FUNCTIONS ============
  const addSurveyQuestion = useCallback(async () => {
    if (!newSurveyQuestion.trim()) return;
    setSurveyQuestionMsg("");
    try {
      const { data } = await API.post("/surveys/questions", { text: newSurveyQuestion.trim() });
      setSurveyQuestions((prev) => [...prev, data]);
      setNewSurveyQuestion("");
    } catch (err) {
      setSurveyQuestionMsg(err.response?.data?.message || "Could not add this question.");
    }
  }, [newSurveyQuestion]);

  const toggleSurveyQuestion = useCallback(async (q) => {
    try {
      const { data } = await API.put(`/surveys/questions/${q._id}`, { active: !q.active });
      setSurveyQuestions((prev) => prev.map((x) => (x._id === q._id ? data : x)));
    } catch (err) {
      setSurveyQuestionMsg(err.response?.data?.message || "Could not update this question.");
    }
  }, []);

  const deleteSurveyQuestion = useCallback(async (id) => {
    try {
      await API.delete(`/surveys/questions/${id}`);
      setSurveyQuestions((prev) => prev.filter((q) => q._id !== id));
    } catch (err) {
      setSurveyQuestionMsg(err.response?.data?.message || "Could not delete this question.");
    }
  }, []);

  // ============ BLOCK FUNCTIONS ============
  const createBlock = useCallback(async () => {
    if (!newBlockName.trim()) {
      setBlockMsg("Please enter a block name.");
      return;
    }
    setBlockMsg("");
    try {
      const { data } = await API.post("/hostel-structure/blocks", {
        name: newBlockName.trim(),
        accommodationType: newBlockType,
        usesCategories: true,
        description: ""
      });
      setBlocks((prev) => [...prev, data]);
      setBlockMsg(`Block "${data.name}" created successfully.`);
      setNewBlockName("");
      API.get("/rooms/blocks").then(({ data: b }) => setKnownBlocks(b)).catch(() => {});
    } catch (err) {
      setBlockMsg(err.response?.data?.message || "Could not create block.");
    }
  }, [newBlockName, newBlockType]);

  const toggleBlockActive = useCallback(async (block) => {
    try {
      const { data } = await API.put(`/hostel-structure/blocks/${block._id}`, { active: !block.active });
      setBlocks((prev) => prev.map((b) => b._id === data._id ? data : b));
      setStructureMsg(`Block "${data.name}" ${data.active ? "activated" : "deactivated"}.`);
    } catch (err) { 
      setStructureError(err.response?.data?.message || "Could not update block."); 
    }
  }, []);

  const deleteBlock = useCallback(async (block) => {
    askConfirm(`Delete block "${block.name}"? This cannot be undone.`, async () => {
      try {
        await API.delete(`/hostel-structure/blocks/${block._id}`);
        setBlocks((prev) => prev.filter((b) => b._id !== block._id));
        setStructureMsg(`Block "${block.name}" deleted.`);
      } catch (err) { 
        setStructureError(err.response?.data?.message || "Could not delete block."); 
      }
    });
  }, [askConfirm]);

  const saveBlock = useCallback(async () => {
    setStructureError("");
    setStructureMsg("");
    try {
      if (editingBlock) {
        const { data } = await API.put(`/hostel-structure/blocks/${editingBlock._id}`, blockForm);
        setBlocks((prev) => prev.map((b) => b._id === data._id ? data : b));
        setStructureMsg(`Block "${data.name}" updated.`);
      } else {
        const { data } = await API.post("/hostel-structure/blocks", blockForm);
        setBlocks((prev) => [...prev, data]);
        setStructureMsg(`Block "${data.name}" created.`);
      }
      setEditingBlock(null);
      setBlockForm({ name: "", accommodationType: "outside_hostel", usesCategories: true, description: "" });
    } catch (err) { 
      setStructureError(err.response?.data?.message || "Could not save block."); 
    }
  }, [editingBlock, blockForm]);

  // ============ SUB-BLOCK FUNCTIONS ============
  const saveSubBlock = useCallback(async (blockId) => {
    setStructureError("");
    const name = (subBlockForm[blockId] || "").trim();
    if (!name) return;
    try {
      const { data } = await API.post(`/hostel-structure/blocks/${blockId}/sub-blocks`, { name });
      setBlocks((prev) => prev.map((b) => b._id === blockId ? data : b));
      setSubBlockForm((prev) => ({ ...prev, [blockId]: "" }));
    } catch (err) { 
      setStructureError(err.response?.data?.message || "Could not add sub-block."); 
    }
  }, [subBlockForm]);

  const saveManagedSubBlock = useCallback(async () => {
    setStructureError("");
    setStructureMsg("");
    
    const parentId = editingSubBlock ? editingSubBlockParent : subBlockParent;
    const name = subBlockName.trim();
    
    if (!parentId) { 
      setStructureError("Please select a Block first."); 
      return; 
    }
    if (!name) { 
      setStructureError("Please enter a Subblock name."); 
      return; 
    }
    
    const parentBlock = blocks.find(b => b._id === parentId);
    if (!parentBlock) {
      setStructureError("Selected block not found. Please refresh the structure.");
      return;
    }

    try {
      let data;
      if (editingSubBlock) {
        const response = await API.put(`/hostel-structure/blocks/${parentId}/sub-blocks/${editingSubBlock._id}`, { name });
        data = response.data;
      } else {
        const response = await API.post(`/hostel-structure/blocks/${parentId}/sub-blocks`, { name });
        data = response.data;
      }
      setBlocks((prev) => prev.map((b) => b._id === data._id ? data : b));
      setStructureMsg(`Subblock "${name}" ${editingSubBlock ? "updated" : "created"} successfully.`);
      setEditingSubBlock(null);
      setEditingSubBlockParent("");
      setSubBlockParent("");
      setSubBlockName("");
      refreshStructure();
    } catch (err) { 
      setStructureError(err.response?.data?.message || "Could not save subblock."); 
    }
  }, [editingSubBlock, editingSubBlockParent, subBlockParent, subBlockName, blocks, refreshStructure]);

  const toggleSubBlockActive = useCallback(async (blockId, subId, current) => {
    try {
      const { data } = await API.put(`/hostel-structure/blocks/${blockId}/sub-blocks/${subId}`, { active: !current });
      setBlocks((prev) => prev.map((b) => b._id === blockId ? data : b));
    } catch (err) { 
      setStructureError(err.response?.data?.message || "Could not update sub-block."); 
    }
  }, []);

  const deleteSubBlock = useCallback(async (blockId, subId, name) => {
    askConfirm(`Delete sub-block "${name}"?`, async () => {
      try {
        const { data } = await API.delete(`/hostel-structure/blocks/${blockId}/sub-blocks/${subId}`);
        setBlocks((prev) => prev.map((b) => b._id === blockId ? data : b));
      } catch (err) { 
        setStructureError(err.response?.data?.message || "Could not delete sub-block."); 
      }
    });
  }, [askConfirm]);

  // ============ CATEGORY FUNCTIONS ============
  const saveCat = useCallback(async () => {
    setStructureError("");
    setStructureMsg("");
    try {
      if (editingCat) {
        const { data } = await API.put(`/hostel-structure/categories/${editingCat._id}`, catForm);
        setCategories((prev) => prev.map((c) => c._id === data._id ? data : c));
        setStructureMsg(`Category "${data.name}" updated.`);
      } else {
        const { data } = await API.post("/hostel-structure/categories", catForm);
        setCategories((prev) => [...prev, data]);
        setStructureMsg(`Category "${data.name}" created.`);
      }
      setEditingCat(null);
      setCatForm({ name: "", price: "", description: "", capacity: 2 });
    } catch (err) { 
      setStructureError(err.response?.data?.message || "Could not save category."); 
    }
  }, [editingCat, catForm]);

  const toggleCatActive = useCallback(async (cat) => {
    try {
      const { data } = await API.put(`/hostel-structure/categories/${cat._id}`, { active: !cat.active });
      setCategories((prev) => prev.map((c) => c._id === data._id ? data : c));
    } catch (err) { 
      setStructureError(err.response?.data?.message || "Could not update category."); 
    }
  }, []);

  const deleteCat = useCallback(async (cat) => {
    askConfirm(`Delete category "${cat.name}"? This cannot be undone.`, async () => {
      try {
        await API.delete(`/hostel-structure/categories/${cat._id}`);
        setCategories((prev) => prev.filter((c) => c._id !== cat._id));
        setStructureMsg(`Category "${cat.name}" deleted.`);
      } catch (err) { 
        setStructureError(err.response?.data?.message || "Could not delete category."); 
      }
    });
  }, [askConfirm]);

  // ============ SAVE EDIT ROOM ============
  const saveEditRoom = useCallback(async () => {
    setEditRoomError("");
    setEditRoomSaving(true);
    try {
      const { data } = await API.put(`/rooms/${editingRoom._id}`, editRoomForm);
      setRooms((prev) => prev.map((r) => r._id === data._id ? data : r));
      setMsg(`Room ${data.roomNumber} updated.`);
      setEditingRoom(null);
    } catch (err) {
      setEditRoomError(err.response?.data?.message || "Could not save room.");
    } finally { 
      setEditRoomSaving(false); 
    }
  }, [editingRoom, editRoomForm]);

  // ============ RECORD OCCUPANT STATUS ============
  const recordOccupantStatus = useCallback((bookingId, occupantId, status, name) => {
    const action = status === "checked-in" ? "check in" : "check out";
    askConfirm(
      `${status === "checked-in" ? "Check in" : "Record"} ${name || "this person"}${status === "checked-out" ? " as checked out?" : "?"}`,
      async () => {
        try {
          const { data } = await API.put(`/bookings/${bookingId}/occupants/${occupantId}/status`, { status });
          setBookings((prev) => prev.map((b) => (b._id === bookingId ? data.booking : b)));
          setBookingMsg(`${name || "Occupant"} ${status === "checked-in" ? "checked in" : "checked out"}.`);
          setBookingError("");
          await refreshRooms();
        } catch (err) { 
          setBookingError(err.response?.data?.message || `Unable to ${action} occupant.`); 
        }
      }
    );
  }, [askConfirm, refreshRooms]);

  // ============ DELETE BOOKING RECORD ============
  const deleteBookingRecordConfirmed = useCallback(async (id) => {
    try {
      await API.delete(`/bookings/${id}/history`);
      setBookings((prev) => prev.filter((b) => b._id !== id));
      setBookingMsg("Booking record deleted.");
      setBookingError("");
      await refreshRooms();
      if (weeklyReport) {
        API.get("/bookings/report").then(({ data }) => setWeeklyReport(data)).catch(() => {});
      }
    } catch (err) {
      setBookingError(err.response?.data?.message || "Unable to delete this booking.");
    }
  }, [refreshRooms, weeklyReport]);

  const deleteBookingRecord = useCallback((id) => {
    askConfirm("Permanently delete this booking record? This can't be undone.", () => deleteBookingRecordConfirmed(id));
  }, [askConfirm, deleteBookingRecordConfirmed]);

  // ============ IMAGE HANDLING ============
  const readRoomImage = useCallback((file, callback) => {
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setAddRoomError("Please choose a JPG, PNG, or WebP image.");
      return;
    }
    if (file.size > 3 * 1024 * 1024) {
      setAddRoomError("Image must be 3 MB or smaller.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => callback(String(reader.result), file.name);
    reader.onerror = () => setAddRoomError("Unable to read the selected image.");
    reader.readAsDataURL(file);
  }, []);

  const MAX_ROOM_PHOTOS = 5;
  
  const addRoomPhotos = useCallback((files) => {
    const list = Array.from(files || []);
    if (!list.length) return;
    if (newRoom.images.length + list.length > MAX_ROOM_PHOTOS) {
      setAddRoomError(`You can upload up to ${MAX_ROOM_PHOTOS} photos per room.`);
      return;
    }
    setAddRoomError("");
    list.forEach((file) => {
      readRoomImage(file, (imageData) => {
        setNewRoom((r) => (r.images.length >= MAX_ROOM_PHOTOS ? r : { ...r, images: [...r.images, imageData] }));
      });
    });
  }, [newRoom.images, readRoomImage]);

  const removeRoomPhoto = useCallback((index) => {
    setNewRoom((r) => ({ ...r, images: r.images.filter((_, i) => i !== index) }));
  }, []);

  // ============ OPEN EDIT ROOM ============
  const openEditRoom = useCallback((room) => {
    setEditingRoom(room);
    setEditRoomForm({
      roomNumber: room.roomNumber,
      category: room.category,
      hostelSection: room.hostelSection || "",
      subBlock: room.subBlock || "",
      price: room.price,
      address: room.address || "",
      description: room.description || "",
      active: room.active !== false,
    });
    setEditRoomError("");
  }, []);

  // ============ EFFECTS ============
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [bookingsRes, roomsRes, clientsRes, concernsRes, surveysRes, blocksRes, categoriesRes, questionsRes] = await Promise.all([
          API.get("/bookings"),
          API.get("/rooms"),
          API.get("/auth/clients"),
          API.get("/concerns"),
          API.get("/surveys"),
          API.get("/hostel-structure/blocks?activeOnly=false"),
          API.get("/hostel-structure/categories?activeOnly=false"),
          API.get("/surveys/questions/all"),
        ]);
        
        setBookings(bookingsRes.data);
        setRooms(roomsRes.data);
        setClients(clientsRes.data);
        setConcerns(concernsRes.data.concerns || concernsRes.data);
        setSurveys(surveysRes.data);
        setBlocks(blocksRes.data);
        setCategories(categoriesRes.data);
        setSurveyQuestions(questionsRes.data);
        
        // Also fetch weekly report and blocks list
        const [reportRes, blocksListRes] = await Promise.all([
          API.get("/bookings/report"),
          API.get("/rooms/blocks")
        ]);
        setWeeklyReport(reportRes.data);
        setKnownBlocks(blocksListRes.data);
        
      } catch (err) {
        console.error("Error loading data:", err);
      }
    };
    
    fetchData();
  }, []);

  useEffect(() => {
    setMonthlyReportError("");
    API.get("/bookings/monthly-report", { params: { month: monthlyReportMonth } })
      .then(({ data }) => setMonthlyReport(data))
      .catch((err) => setMonthlyReportError(err.response?.data?.message || "Unable to load monthly performance."));
  }, [monthlyReportMonth]);

  useEffect(() => {
    if (!highlightBookingId || tab !== "Bookings") return;
    const el = document.getElementById(`booking-row-${highlightBookingId}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.style.transition = "box-shadow 0.3s";
      el.style.boxShadow = "0 0 0 3px #c9960d";
      const t = setTimeout(() => { 
        el.style.boxShadow = "none"; 
        setHighlightBookingId(null); 
      }, 2500);
      return () => clearTimeout(t);
    }
  }, [highlightBookingId, tab, bookingSubTab]);

  useEffect(() => {
    if (!blocks.length) return;
    setNewRoom((r) => {
      const currentBlock = blocks.find((b) => b.name === r.hostelSection);
      const block = currentBlock || blocks.find((b) => b.active !== false);
      const activeCategories = categories.filter((c) => c.active);
      const categoryStillExists = activeCategories.some((c) => c.name === r.category);
      return {
        ...r,
        hostelSection: block?.name || r.hostelSection,
        accommodationType: block?.accommodationType || r.accommodationType,
        category: categoryStillExists ? r.category : (activeCategories[0]?.name || "")
      };
    });
  }, [blocks, categories]);

  // ============ CALCULATE STATS ============
  const stats = {
    totalBookings: bookings.length,
    pending: bookings.filter((b) => b.status === "pending").length,
    confirmed: bookings.filter((b) => b.status === "confirmed").length,
    checkedIn: bookings.filter((b) => b.status === "checked-in").length,
    checkedOut: bookings.filter((b) => b.status === "checked-out").length,
    cancelled: bookings.filter((b) => b.status === "cancelled").length,
    rejected: bookings.filter((b) => b.status === "rejected").length,
    revenue: bookings.reduce((sum, b) => {
      const paid = (b.paymentTransactions || []).reduce((n, tx) => n + Number(tx.amount || 0), 0);
      const refunded = (b.paymentTransactions || []).reduce((n, tx) => n + Number(tx.refundedAmount || 0), 0);
      const owed = Number(b.refundAmountOwed || 0);
      return sum + Math.max(0, paid - refunded - owed);
    }, 0),
    availableRooms: rooms.filter((r) => r.status === "available").length,
    bookedRooms: rooms.filter((r) => r.status === "booked").length,
    totalClients: clients.length,
    concernsOpen: concerns.filter((c) => c.status === "open").length,
    averageRating: surveys.length > 0 ? (surveys.reduce((sum, s) => sum + s.rating, 0) / surveys.length).toFixed(1) : "N/A",
  };

  // ============ FILTERED DATA ============
  const filteredBookings = bookings.filter((b) =>
    b.client?.name?.toLowerCase().includes(search.toLowerCase()) ||
    b.client?.email?.toLowerCase().includes(search.toLowerCase()) ||
    b.room?.roomNumber?.includes(search)
  );

  const ACCOMMODATION_DISPLAY_ORDER = { ilpd_building: 0, outside_hostel: 1 };
  const filteredRooms = rooms
    .filter((r) =>
      r.roomNumber?.includes(search) ||
      r.category?.toLowerCase().includes(search.toLowerCase())
    )
    .slice()
    .sort((a, b) => {
      const typeDiff = (ACCOMMODATION_DISPLAY_ORDER[a.accommodationType] ?? 2) - (ACCOMMODATION_DISPLAY_ORDER[b.accommodationType] ?? 2);
      if (typeDiff !== 0) return typeDiff;
      return (a.roomNumber || "").localeCompare(b.roomNumber || "", undefined, { numeric: true });
    });

  const filteredConcerns = concerns.filter((c) =>
    c.subject?.toLowerCase().includes(search.toLowerCase()) ||
    c.message?.toLowerCase().includes(search.toLowerCase()) ||
    c.client?.name?.toLowerCase().includes(search.toLowerCase()) ||
    c.client?.email?.toLowerCase().includes(search.toLowerCase())
  );

  const filteredSurveys = surveys.filter((s) =>
    s.client?.name?.toLowerCase().includes(search.toLowerCase()) ||
    s.client?.email?.toLowerCase().includes(search.toLowerCase()) ||
    s.comments?.toLowerCase().includes(search.toLowerCase())
  );

  // ============ STYLES ============
  const styles = {
    statsGrid: { 
      display: "grid", 
      gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", 
      gap: "16px", 
      marginBottom: "32px" 
    },
    statCard: { 
      textAlign: "center", 
      padding: "20px", 
      background: "#fffdf9", 
      border: "1px solid #f0ede6" 
    },
    recentSection: { marginTop: "8px" },
    table: { 
      width: "100%", 
      borderCollapse: "collapse", 
      background: "#fffdf9", 
      borderRadius: "10px", 
      overflow: "hidden", 
      fontSize: "14px", 
      border: "1px solid #f0ede6" 
    },
    th: { 
      background: "#1a1a2e", 
      color: "#f0c040", 
      padding: "12px 16px", 
      textAlign: "left", 
      fontSize: "13px", 
      whiteSpace: "nowrap" 
    },
    td: { 
      padding: "12px 16px", 
      borderBottom: "1px solid #f5f0e8", 
      verticalAlign: "middle", 
      color: "#333" 
    },
  };

  // ============ RENDER ============
  return (
    <div className="container" style={{ padding: "40px 20px" }}>
      <div style={{ marginBottom: "24px" }}>
        <h2 style={{ fontSize: "28px", fontWeight: "700" }}>Admin Dashboard</h2>
        <p style={{ color: "#666", marginTop: "4px" }}>Full access to all hostel operations</p>
      </div>

      {stats.pending > 0 && (
        <div style={{ 
          marginBottom: "20px", 
          padding: "14px 18px", 
          borderRadius: "10px", 
          background: "#fff1f0", 
          border: "2px solid #ff4d4f", 
          color: "#a8071a", 
          fontSize: "14px", 
          fontWeight: "600", 
          display: "flex", 
          alignItems: "center", 
          gap: "10px" 
        }}>
          <span style={{ fontSize: "20px", animation: "pulse 1s infinite" }}>🔔</span>
          <span>
            {stats.pending} new booking{stats.pending > 1 ? "s" : ""} pending room allocation — go to 
            <button 
              onClick={() => { setTab("Bookings"); setBookingSubTab("Waiting List"); }} 
              style={{ 
                background: "none", 
                border: "none", 
                color: "#a8071a", 
                fontWeight: "700", 
                textDecoration: "underline", 
                cursor: "pointer", 
                fontSize: "14px", 
                padding: 0 
              }}
            >
              Bookings
            </button> 
            to allocate.
          </span>
        </div>
      )}

      <div style={{ display: "flex", gap: "10px", marginBottom: "28px", flexWrap: "wrap" }}>
        {TABS.map((t) => (
          <button 
            key={t} 
            className={`btn ${tab === t ? "btn-primary" : "btn-outline"}`} 
            onClick={() => { setTab(t); setSearch(""); }}
          >
            {t === "Overview" ? "📊 Overview"
              : t === "Reports" ? "📈 Reports"
              : t === "Bookings" ? "📋 Bookings"
              : t === "Rooms" ? "🏠 Rooms"
              : t === "Clients" ? "👥 Clients"
              : t === "Guest Support" ? "📨 Guest Support"
              : "⭐ Surveys"}
          </button>
        ))}
      </div>

      {/* ===== OVERVIEW TAB ===== */}
      {tab === "Overview" && (
        <>
          {(() => {
            const isSameDay = (d1, d2) => new Date(d1).toDateString() === new Date(d2).toDateString();
            const today = new Date();
            const dueCheckIns = bookings.filter((b) => b.status === "confirmed" && new Date(b.checkIn) <= today);
            const dueCheckOuts = bookings.filter((b) => b.status === "checked-in" && new Date(b.checkOut) <= today);
            if (!dueCheckIns.length && !dueCheckOuts.length) return null;
            return (
              <div style={{ display: "grid", gap: "14px", gridTemplateColumns: "1fr 1fr", marginBottom: "20px" }}>
                {dueCheckIns.length > 0 && (
                  <div className="card" style={{ padding: "16px", border: "1px solid #fbd38d", background: "#fffaf0" }}>
                    <h4 style={{ margin: "0 0 10px", color: "#7c5a10" }}>⏰ Guests to Check In Today ({dueCheckIns.length})</h4>
                    {dueCheckIns.map((b) => (
                      <div key={b._id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderTop: "1px solid #fbd38d33", fontSize: "13px" }}>
                        <span>
                          <strong>{b.client?.name}</strong> — {b.room?.roomNumber ? `Room ${b.room.roomNumber}` : `${b.category} (not yet allocated)`}
                          {isSameDay(b.checkIn, today) ? "" : " · overdue"}
                        </span>
                        {b.room ? (
                          <button className="btn btn-primary" style={{ padding: "5px 10px", fontSize: "12px" }} onClick={() => { jumpToBooking(b, "Waiting List"); recordCheckin(b._id); }}>Check In</button>
                        ) : (
                          <button className="btn btn-secondary" style={{ padding: "5px 10px", fontSize: "12px" }} onClick={() => jumpToBooking(b, "Waiting List")}>Allocate Room</button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                {dueCheckOuts.length > 0 && (
                  <div className="card" style={{ padding: "16px", border: "1px solid #90cdf4", background: "#ebf8ff" }}>
                    <h4 style={{ margin: "0 0 10px", color: "#2a69ac" }}>🚪 Guests to Check Out Today ({dueCheckOuts.length})</h4>
                    {dueCheckOuts.map((b) => (
                      <div key={b._id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderTop: "1px solid #90cdf433", fontSize: "13px" }}>
                        <span>
                          <strong>{b.client?.name}</strong> — Room {b.room?.roomNumber}
                          {isSameDay(b.checkOut, today) ? "" : " · overdue"}
                        </span>
                        <button className="btn btn-primary" style={{ padding: "5px 10px", fontSize: "12px" }} onClick={() => { jumpToBooking(b, "Checked In"); recordCheckout(b._id); }}>Check Out</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })()}

          <div style={styles.statsGrid}>
            {[
              ["💰 Total Revenue", fmt(stats.revenue), "#b8860b"],
              ["📋 Total Bookings", stats.totalBookings, "#1a1a2e"],
              ["🟡 Pending Allocation", stats.pending, "#d97706"],
              ["✅ Confirmed", stats.confirmed, "#276749"],
              ["🏨 Checked In", stats.checkedIn, "#2a69ac"],
              ["👋 Checked Out", stats.checkedOut, "#4a5568"],
              ["🚫 Rejected", stats.rejected, "#9b2c2c"],
              ["❌ Cancelled", stats.cancelled, "#9b2c2c"],
              ["🟢 Available Rooms", stats.availableRooms, "#276749"],
              ["🔴 Booked Rooms", stats.bookedRooms, "#9b2c2c"],
              ["👥 Total Clients", stats.totalClients, "#553c9a"],
              ["📣 Open Concerns", stats.concernsOpen, "#d69e2e"],
              ["⭐ Avg. Guest Rating", stats.averageRating, "#b83280"],
            ].map(([label, val, color]) => (
              <div key={label} className="card" style={styles.statCard}>
                <p style={{ fontSize: "26px", fontWeight: "700", color }}>{val}</p>
                <p style={{ color: "#888", fontSize: "13px", marginTop: "4px" }}>{label}</p>
              </div>
            ))}
          </div>

          <div style={styles.recentSection}>
            <h3 style={{ marginBottom: "16px", fontSize: "18px" }}>📋 Recent Bookings</h3>
            <div style={{ overflowX: "auto" }}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    {["Client", "Room", "Check-in", "Check-out", "Total", "Status"].map((h) => (
                      <th key={h} style={styles.th}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {bookings.slice(0, 5).map((b) => (
                    <tr key={b._id}>
                      <td style={styles.td}>
                        {b.client?.name}<br />
                        <small style={{ color: "#888" }}>{b.client?.email}</small>
                      </td>
                      <td style={styles.td}>
                        {b.room?.roomNumber ? `Room ${b.room.roomNumber}` : <span style={{ color: "#888" }}>{b.category} — Pending</span>}
                        <br />
                        <small style={{ color: "#b8860b" }}>{b.room?.category || b.category}</small>
                      </td>
                      <td style={styles.td}>{new Date(b.checkIn).toDateString()}</td>
                      <td style={styles.td}>{new Date(b.checkOut).toDateString()}</td>
                      <td style={{ ...styles.td, fontWeight: "600", color: "#b8860b" }}>{fmt(b.totalPrice)}</td>
                      <td style={styles.td}>
                        <span style={{ 
                          background: STATUS_COLORS[b.status]?.bg, 
                          color: STATUS_COLORS[b.status]?.color, 
                          padding: "4px 10px", 
                          borderRadius: "20px", 
                          fontSize: "12px", 
                          fontWeight: "600" 
                        }}>
                          {b.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* ===== REPORTS TAB ===== */}
      {tab === "Reports" && (
        <>
          <div style={{ marginBottom: "32px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px", marginBottom: "12px" }}>
              <h3 style={{ fontSize: "20px", margin: 0 }}>📊 Monthly Performance Dashboard</h3>
              <input 
                type="month" 
                value={monthlyReportMonth} 
                onChange={(e) => setMonthlyReportMonth(e.target.value)} 
                style={{ marginBottom: 0 }} 
              />
            </div>
            {monthlyReportError && <p style={{ color: "#b91c1c", marginBottom: "12px" }}>{monthlyReportError}</p>}
            {!monthlyReport ? (
              <div style={{ textAlign: "center", padding: "30px" }}>
                <p>Loading monthly performance...</p>
              </div>
            ) : (
              <>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "16px", marginBottom: "20px" }}>
                  {[
                    ["Total Bookings", monthlyReport.totalBookings, "#1a1a2e"],
                    ["Total Revenue", fmt(monthlyReport.totalRevenue), "#b8860b"],
                    ["Occupancy Rate", `${monthlyReport.occupancyRate}%`, "#2a69ac"],
                    ["Avg. Stay Length", `${monthlyReport.averageStayDays} days`, "#4a5568"],
                    ["Checked In", monthlyReport.checkedIn, "#2f855a"],
                    ["Checked Out", monthlyReport.checkedOut, "#4a5568"],
                    ["Cancelled", monthlyReport.cancelled, "#9b2c2c"],
                    ["Rejected", monthlyReport.rejected, "#9b2c2c"],
                    ["New Concerns", monthlyReport.newConcerns, "#b7791f"],
                    ["Avg. Guest Rating", monthlyReport.averageRating ? `${monthlyReport.averageRating} / 5` : "—", "#805ad5"],
                  ].map(([label, val, color]) => (
                    <div key={label} className="card" style={{ ...styles.statCard, borderColor: color }}>
                      <p style={{ fontSize: "22px", fontWeight: "700", color }}>{val}</p>
                      <p style={{ color: "#888", fontSize: "12px", marginTop: "4px" }}>{label}</p>
                    </div>
                  ))}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "16px" }}>
                  <div className="card" style={{ padding: "16px" }}>
                    <h4 style={{ margin: "0 0 10px", fontSize: "15px" }}>Revenue by Category</h4>
                    {Object.entries(monthlyReport.revenueByCategory || {}).length ? (
                      Object.entries(monthlyReport.revenueByCategory).map(([cat, rev]) => (
                        <div key={cat} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderTop: "1px solid #eee", fontSize: "13px" }}>
                          <span>{cat}</span>
                          <strong style={{ color: "#b8860b" }}>{fmt(rev)}</strong>
                        </div>
                      ))
                    ) : (
                      <p style={{ color: "#999", fontSize: "13px" }}>No revenue this month yet.</p>
                    )}
                  </div>
                  <div className="card" style={{ padding: "16px" }}>
                    <h4 style={{ margin: "0 0 10px", fontSize: "15px" }}>Revenue by Location</h4>
                    {[["ilpd_building", "ILPD Building"], ["outside_hostel", "Hostel Block"]].map(([key, label]) => (
                      <div key={key} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderTop: "1px solid #eee", fontSize: "13px" }}>
                        <span>{label}</span>
                        <strong style={{ color: "#b8860b" }}>{fmt(monthlyReport.revenueByLocation?.[key] || 0)}</strong>
                      </div>
                    ))}
                  </div>
                  <div className="card" style={{ padding: "16px" }}>
                    <h4 style={{ margin: "0 0 10px", fontSize: "15px" }}>Room Occupancy</h4>
                    <p style={{ fontSize: "13px", color: "#555" }}>
                      {monthlyReport.occupiedRooms} of {monthlyReport.totalRooms} rooms had a booking overlapping this month.
                    </p>
                  </div>
                </div>
              </>
            )}
          </div>

          <div style={{ marginBottom: "24px" }}>
            <h3 style={{ fontSize: "20px", marginBottom: "12px" }}>Weekly Booking Report</h3>
            {reportError && <p style={{ color: "#b91c1c", marginBottom: "12px" }}>{reportError}</p>}
            {!weeklyReport ? (
              <div style={{ textAlign: "center", padding: "30px" }}>
                <p>Loading weekly report...</p>
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "16px", marginBottom: "24px" }}>
                {[
                  ["Total Bookings", weeklyReport.totalBookings, "#1a1a2e"],
                  ["Total Revenue", fmt(weeklyReport.totalRevenue), "#b8860b"],
                  ["Checked In", weeklyReport.checkedIn, "#2a69ac"],
                  ["Checked Out", weeklyReport.checkedOut, "#4a5568"],
                  ["Rejected", weeklyReport.rejected, "#9b2c2c"],
                  ["Cancelled", weeklyReport.cancelled, "#9b2c2c"],
                ].map(([label, val, color]) => (
                  <div key={label} className="card" style={{ ...styles.statCard, borderColor: color }}>
                    <p style={{ fontSize: "24px", fontWeight: "700", color }}>{val}</p>
                    <p style={{ color: "#888", fontSize: "13px", marginTop: "4px" }}>{label}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div>
            <h4 style={{ marginBottom: "12px" }}>Recent Bookings This Week</h4>
            <div style={{ overflowX: "auto" }}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    {["Client", "Room", "Check-in", "Check-out", "Total", "Status"].map((h) => (
                      <th key={h} style={styles.th}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(weeklyReport?.bookings || []).map((b) => (
                    <tr key={b._id}>
                      <td style={styles.td}>
                        {b.client?.name}<br />
                        <small style={{ color: "#888" }}>{b.client?.email}</small>
                      </td>
                      <td style={styles.td}>
                        Room {b.room?.roomNumber}{b.room?.hostelSection ? ` — ${b.room.hostelSection}` : ""}
                      </td>
                      <td style={styles.td}>{new Date(b.checkIn).toDateString()}</td>
                      <td style={styles.td}>{new Date(b.checkOut).toDateString()}</td>
                      <td style={{ ...styles.td, fontWeight: "700", color: "#b8860b" }}>{fmt(b.totalPrice)}</td>
                      <td style={styles.td}>
                        <span style={{ 
                          background: STATUS_COLORS[b.status]?.bg, 
                          color: STATUS_COLORS[b.status]?.color, 
                          padding: "4px 10px", 
                          borderRadius: "20px", 
                          fontSize: "12px", 
                          fontWeight: "600" 
                        }}>
                          {b.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {weeklyReport?.bookings?.length === 0 && (
                    <tr>
                      <td colSpan="6" style={{ ...styles.td, textAlign: "center", color: "#888", padding: "40px" }}>
                        No bookings this week.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* ===== BOOKINGS TAB ===== */}
      {tab === "Bookings" && (
        <>
          <div style={{ marginBottom: "16px", display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap" }}>
            <input 
              placeholder="🔍 Search by client name, email or room number..." 
              value={search} 
              onChange={(e) => { setSearch(e.target.value); setBookingsShown(25); }} 
              style={{ maxWidth: "400px", marginBottom: 0 }} 
            />
            <span style={{ color: "#888", fontSize: "13px" }}>
              {filteredBookings.length} booking{filteredBookings.length !== 1 ? "s" : ""} found
            </span>
            {bookingMsg && <span className="success">✅ {bookingMsg}</span>}
            {bookingError && <span className="error">⚠️ {bookingError}</span>}
          </div>
          <p style={{ color: "#888", fontSize: "12px", marginBottom: "16px" }}>
            💡 Waiting List and Checked In always show everything, up to the minute. Checked Out and Cancelled/Rejected show your 300 most recent — this keeps things fast no matter how many years of history build up.
          </p>

          {(() => {
            const waitingList = filteredBookings.filter((b) => b.status === "pending" || b.status === "confirmed");
            const checkedIn = filteredBookings.filter((b) => b.status === "checked-in");
            const checkedOut = filteredBookings.filter((b) => b.status === "checked-out");
            const closedOut = filteredBookings.filter((b) => b.status === "cancelled" || b.status === "rejected");

            const SUB_TABS = [
              { key: "Waiting List", icon: "⏳", list: waitingList },
              { key: "Checked In", icon: "🟢", list: checkedIn },
              { key: "Checked Out", icon: "✅", list: checkedOut },
              { key: "Cancelled / Rejected", icon: "🚫", list: closedOut },
            ];
            const activeSub = SUB_TABS.find((s) => s.key === bookingSubTab) || SUB_TABS[0];
            const emptyTextByKey = {
              "Waiting List": "No bookings waiting for check-in.",
              "Checked In": "No guests currently checked in.",
              "Checked Out": "No completed stays yet.",
              "Cancelled / Rejected": "No cancelled or rejected bookings.",
            };

            const renderRow = (b) => {
              const duration = b.billingPeriod === "night" 
                ? Math.max(1, Math.ceil((new Date(b.checkOut) - new Date(b.checkIn)) / 86400000)) 
                : Number(b.billingMonths || 1);
              const durationLabel = b.billingPeriod === "night" ? "night" : "month";
              
              return (
                <div key={b._id} id={`booking-row-${b._id}`} className="card" style={{ padding: "16px 18px", marginBottom: "12px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", flexWrap: "wrap", gap: "10px", marginBottom: "10px" }}>
                    <div>
                      <strong style={{ fontSize: "15px" }}>{b.client?.name}</strong>
                      <div style={{ color: "#888", fontSize: "12px" }}>
                        {b.client?.email} · {b.client?.phone || "N/A"}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                      <span style={{ 
                        background: STATUS_COLORS[b.status]?.bg, 
                        color: STATUS_COLORS[b.status]?.color, 
                        padding: "4px 10px", 
                        borderRadius: "20px", 
                        fontSize: "12px", 
                        fontWeight: "600" 
                      }}>
                        {b.status}
                      </span>
                      <span style={{ 
                        background: b.paymentStatus === "paid" ? "#c6f6d5" : "#fed7d7", 
                        color: b.paymentStatus === "paid" ? "#276749" : "#9b2c2c", 
                        padding: "4px 10px", 
                        borderRadius: "20px", 
                        fontSize: "12px", 
                        fontWeight: "600" 
                      }}>
                        {b.paymentStatus}
                      </span>
                    </div>
                  </div>

                  <div style={{ 
                    display: "flex", 
                    flexWrap: "wrap", 
                    gap: "16px", 
                    fontSize: "13px", 
                    color: "#444", 
                    marginBottom: "12px", 
                    paddingBottom: "12px", 
                    borderBottom: "1px solid #f0ede6" 
                  }}>
                    <span>
                      🏠 {b.room?.roomNumber ? <strong>Room {b.room.roomNumber}</strong> : <span style={{ color: "#888" }}>Not yet allocated</span>}
                    </span>
                    <span>
                      📍 {b.room?.accommodationType === "ilpd_building" || b.accommodationType === "ilpd_building" ? "ILPD Building" : "Hostel Block"}
                    </span>
                    <span>🏷️ {b.room?.category || b.category || "—"}</span>
                    <span>
                      👥 {b.numberOfOccupants || b.occupants?.length || 1} occupant{(b.numberOfOccupants || 1) > 1 ? "s" : ""}
                    </span>
                    <span>
                      📅 {new Date(b.checkIn).toLocaleDateString()} → {new Date(b.checkOut).toLocaleDateString()} ({duration} {durationLabel}{duration > 1 ? "s" : ""})
                    </span>
                    <span style={{ fontWeight: "700", color: "#b8860b" }}>💰 {fmt(b.totalPrice)}</span>
                  </div>

                  <div>
                    {b.status === "pending" ? (
                      allocatingId === b._id ? (
                        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
                          <div>
                            <div style={{ fontSize: "11px", fontWeight: "700", marginBottom: "4px" }}>
                              Select {b.numberOfOccupants || b.occupants?.length || 1} room(s)
                            </div>
                            <select 
                              multiple 
                              value={allocateRoomId} 
                              onChange={(e) => setAllocateRoomId(Array.from(e.target.selectedOptions, (o) => o.value))} 
                              style={{ width: "220px", minHeight: "72px", marginBottom: 0, fontSize: "12px" }}
                            >
                              {allocationRooms.map((r) => (
                                <option key={r._id} value={r._id}>
                                  Room {r.roomNumber}{r.hostelSection ? ` — ${r.hostelSection}` : ""}
                                </option>
                              ))}
                            </select>
                          </div>
                          <button className="btn btn-primary" style={{ minWidth: "90px" }} onClick={() => allocateRoom(b._id)}>
                            Allocate
                          </button>
                          <button 
                            className="btn btn-secondary" 
                            style={{ minWidth: "70px" }} 
                            onClick={() => { setAllocatingId(null); setAllocateRoomId([]); setAllocationRooms([]); }}
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                          <button className="btn btn-primary" style={{ minWidth: "100px" }} onClick={() => openAllocation(b)}>
                            Allocate Room
                          </button>
                          <button className="btn btn-danger" style={{ minWidth: "80px" }} onClick={() => cancelBooking(b._id)}>
                            Cancel
                          </button>
                        </div>
                      )
                    ) : b.occupants?.length ? (
                      <div style={{ display: "grid", gap: "7px" }}>
                        {b.occupants.map((o, i) => (
                          <div 
                            key={o._id || i} 
                            style={{ 
                              display: "flex", 
                              alignItems: "center", 
                              justifyContent: "space-between", 
                              gap: "8px", 
                              padding: "6px 10px", 
                              background: "#f8f9fa", 
                              borderRadius: "7px", 
                              flexWrap: "wrap" 
                            }}
                          >
                            <span style={{ fontSize: "12px" }}>
                              <strong>{o.name || `Person ${i + 1}`}</strong>
                              <br />
                              <span style={{ color: "#777" }}>
                                {o.room?.roomNumber ? `Room ${o.room.roomNumber}` : "No room"} · {o.status}
                              </span>
                            </span>
                            {o.status === "confirmed" && (
                              <button 
                                className="btn btn-primary" 
                                style={{ minWidth: "80px", padding: "6px 8px", fontSize: "11px" }} 
                                onClick={() => recordOccupantStatus(b._id, o._id, "checked-in", o.name)}
                              >
                                Check In
                              </button>
                            )}
                            {o.status === "checked-in" && (
                              <button 
                                className="btn btn-primary" 
                                style={{ minWidth: "80px", padding: "6px 8px", fontSize: "11px" }} 
                                onClick={() => recordOccupantStatus(b._id, o._id, "checked-out", o.name)}
                              >
                                Check Out
                              </button>
                            )}
                            {o.status === "checked-out" && (
                              <span style={{ fontSize: "11px", color: "#4a5568" }}>Released</span>
                            )}
                          </div>
                        ))}
                        <button className="btn btn-danger" style={{ minWidth: "80px" }} onClick={() => cancelBooking(b._id)}>
                          Cancel
                        </button>
                      </div>
                    ) : b.status === "confirmed" ? (
                      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                        <button className="btn btn-primary" style={{ minWidth: "110px" }} onClick={() => recordCheckin(b._id)}>
                          Check In
                        </button>
                        {reallocatingId === b._id ? (
                          <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
                            <select 
                              value={reallocateRoomId} 
                              onChange={(e) => setReallocateRoomId(e.target.value)} 
                              style={{ width: "200px", marginBottom: 0, fontSize: "12px" }}
                            >
                              <option value="">Select new room...</option>
                              {reallocateRooms.map((r) => (
                                <option key={r._id} value={r._id}>
                                  Room {r.roomNumber}{r.hostelSection ? ` — ${r.hostelSection}` : ""}
                                </option>
                              ))}
                            </select>
                            <button className="btn btn-primary" style={{ padding: "5px 10px", fontSize: "12px" }} onClick={() => confirmReallocate(b._id)}>
                              Confirm
                            </button>
                            <button 
                              className="btn btn-secondary" 
                              style={{ padding: "5px 10px", fontSize: "12px" }} 
                              onClick={() => { setReallocatingId(null); setReallocateRoomId(""); }}
                            >
                              ✕
                            </button>
                          </div>
                        ) : (
                          <button className="btn btn-secondary" style={{ minWidth: "110px" }} onClick={() => openReallocate(b)}>
                            🔄 Change Room
                          </button>
                        )}
                      </div>
                    ) : b.status === "checked-in" ? (
                      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                        <button className="btn btn-primary" style={{ minWidth: "120px" }} onClick={() => recordCheckout(b._id)}>
                          Check Out
                        </button>
                        {reallocatingId === b._id ? (
                          <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
                            <select 
                              value={reallocateRoomId} 
                              onChange={(e) => setReallocateRoomId(e.target.value)} 
                              style={{ width: "200px", marginBottom: 0, fontSize: "12px" }}
                            >
                              <option value="">Select new room...</option>
                              {reallocateRooms.map((r) => (
                                <option key={r._id} value={r._id}>
                                  Room {r.roomNumber}{r.hostelSection ? ` — ${r.hostelSection}` : ""}
                                </option>
                              ))}
                            </select>
                            <button className="btn btn-primary" style={{ padding: "5px 10px", fontSize: "12px" }} onClick={() => confirmReallocate(b._id)}>
                              Confirm
                            </button>
                            <button 
                              className="btn btn-secondary" 
                              style={{ padding: "5px 10px", fontSize: "12px" }} 
                              onClick={() => { setReallocatingId(null); setReallocateRoomId(""); }}
                            >
                              ✕
                            </button>
                          </div>
                        ) : (
                          <button className="btn btn-secondary" style={{ minWidth: "110px" }} onClick={() => openReallocate(b)}>
                            🔄 Change Room
                          </button>
                        )}
                      </div>
                    ) : b.status === "cancelled" || b.status === "rejected" ? (
                      <button className="btn btn-danger" style={{ fontSize: "12px", padding: "6px 10px" }} onClick={() => deleteBookingRecord(b._id)}>
                        🗑️ Delete History
                      </button>
                    ) : (
                      <button className="btn btn-danger" style={{ minWidth: "80px" }} onClick={() => cancelBooking(b._id)}>
                        Cancel Booking
                      </button>
                    )}
                  </div>
                </div>
              );
            };

            const visibleRows = activeSub.list.slice(0, bookingsShown);

            return (
              <>
                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "18px" }}>
                  {SUB_TABS.map((s) => (
                    <button
                      key={s.key}
                      className={`btn ${bookingSubTab === s.key ? "btn-primary" : "btn-outline"}`}
                      onClick={() => { setBookingSubTab(s.key); setBookingsShown(25); }}
                    >
                      {s.icon} {s.key} ({s.list.length})
                    </button>
                  ))}
                </div>

                <div>
                  {visibleRows.length ? visibleRows.map(renderRow) : (
                    <p style={{ textAlign: "center", color: "#888", padding: "40px" }}>
                      {emptyTextByKey[activeSub.key]}
                    </p>
                  )}
                </div>
                {activeSub.list.length > bookingsShown && (
                  <div style={{ textAlign: "center", marginTop: "16px" }}>
                    <button className="btn btn-secondary" onClick={() => setBookingsShown((n) => n + 25)}>
                      Show more ({activeSub.list.length - bookingsShown} remaining)
                    </button>
                  </div>
                )}
              </>
            );
          })()}
        </>
      )}

      {/* ===== ROOMS TAB ===== */}
      {tab === "Rooms" && (
        <>
          <div style={{ marginBottom: "16px", display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap" }}>
            <button className="btn btn-primary" onClick={() => { setShowAddRoom((v) => !v); setAddRoomError(""); }}>
              {showAddRoom ? "✕ Close Add Room" : "➕ Add Room"}
            </button>
            <button className="btn btn-secondary" onClick={() => setShowStructure(!showStructure)}>
              {showStructure ? "✕ Close Structure" : "🏗️ Manage Structure"}
            </button>
            <button className="btn btn-secondary" onClick={() => checkRoomHealth(true)} disabled={healthChecking}>
              {healthChecking ? "Checking..." : "🩺 Check Room Health"}
            </button>
            {msg && <span className="success">✅ {msg}</span>}
            <input 
              placeholder="🔍 Search by room number or category..." 
              value={search} 
              onChange={(e) => setSearch(e.target.value)} 
              style={{ maxWidth: "300px", marginBottom: 0 }} 
            />
            <span style={{ color: "#888", fontSize: "13px" }}>{filteredRooms.length} rooms</span>
          </div>

          {/* Structure Section */}
          {showStructure && (
            <div className="card" style={{ padding: "20px", marginBottom: "20px", border: "2px solid #3182ce", background: "#f7fafc" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                <h3 style={{ margin: 0, fontSize: "18px" }}>🏗️ Hostel Structure Management</h3>
                <div style={{ display: "flex", gap: "8px" }}>
                  <button className="btn btn-secondary" style={{ fontSize: "12px" }} onClick={refreshStructure}>🔄 Refresh</button>
                  <button className="btn btn-secondary" style={{ fontSize: "12px" }} onClick={() => setShowStructure(false)}>✕ Close</button>
                </div>
              </div>
              {structureMsg && <span className="success" style={{ display: "block", marginBottom: "12px" }}>✅ {structureMsg}</span>}
              {structureError && <span className="error" style={{ display: "block", marginBottom: "12px" }}>⚠️ {structureError}</span>}

              {/* Blocks Section */}
              <div style={{ marginBottom: "16px", padding: "14px", background: "#fff", border: "1px solid #e2e8f0", borderRadius: "8px" }}>
                <h4 style={{ margin: "0 0 10px", fontSize: "14px" }}>🏢 Blocks</h4>
                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
                  <input 
                    value={newBlockName} 
                    onChange={(e) => setNewBlockName(e.target.value)} 
                    placeholder="Block name" 
                    style={{ width: "210px", marginBottom: 0, padding: "6px 10px", border: "1px solid #ddd", borderRadius: "4px" }} 
                  />
                  <button className="btn btn-primary" style={{ padding: "6px 14px", fontSize: "13px" }} onClick={createBlock}>
                    + Create Block
                  </button>
                  {blocks.length > 0 && (
                    <button 
                      className="btn btn-danger" 
                      style={{ padding: "6px 14px", fontSize: "13px" }} 
                      onClick={() => {
                        askConfirm(
                          `Delete ALL ${blocks.length} blocks? This will also delete all subblocks inside them. This cannot be undone!`,
                          async () => {
                            for (const block of blocks) {
                              await API.delete(`/hostel-structure/blocks/${block._id}`);
                            }
                            await refreshStructure();
                            setStructureMsg(`✅ All ${blocks.length} blocks have been deleted.`);
                          }
                        );
                      }}
                    >
                      🗑️ Delete All Blocks
                    </button>
                  )}
                  {blockMsg && <span style={{ fontSize: "12px", color: "#276749" }}>✅ {blockMsg}</span>}
                </div>
                <p style={{ fontSize: "12px", color: "#666", marginTop: "8px" }}>
                  💡 Blocks are building sections. Categories are room types.
                </p>
              </div>

              {/* Edit Block Form */}
              {editingBlock && (
                <div style={{ marginBottom: "12px", padding: "12px", background: "#fffaf0", border: "1px solid #f0e0c0", borderRadius: "8px" }}>
                  <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "flex-end" }}>
                    <div>
                      <label style={{ fontSize: "12px", display: "block", marginBottom: "3px" }}>Block name *</label>
                      <input 
                        value={blockForm.name} 
                        onChange={(e) => setBlockForm((f) => ({ ...f, name: e.target.value }))} 
                        style={{ width: "210px", marginBottom: 0, padding: "6px 10px", border: "1px solid #ddd", borderRadius: "4px" }} 
                      />
                    </div>
                    <button className="btn btn-primary" onClick={saveBlock}>Save Changes</button>
                    <button 
                      className="btn btn-secondary" 
                      onClick={() => { 
                        setEditingBlock(null); 
                        setBlockForm({ name: "", accommodationType: "outside_hostel", usesCategories: true, description: "" }); 
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {/* Existing Blocks List */}
              <div style={{ marginBottom: "16px" }}>
                <h4 style={{ margin: "0 0 12px", fontSize: "14px" }}>🏢 Existing Blocks</h4>
                {blocks.length === 0 && <p style={{ color: "#999", fontSize: "13px" }}>No blocks yet. Add one above.</p>}
                {blocks.map((block) => (
                  <div key={block._id} style={{ border: "1px solid #e2e8f0", borderRadius: "10px", marginBottom: "12px", overflow: "hidden" }}>
                    <div style={{ 
                      display: "flex", 
                      justifyContent: "space-between", 
                      alignItems: "center", 
                      padding: "10px 14px", 
                      background: block.active !== false ? "#f7fafc" : "#fff5f5", 
                      flexWrap: "wrap", 
                      gap: "8px" 
                    }}>
                      <div>
                        <strong style={{ fontSize: "14px", color: block.active !== false ? "#1a1a2e" : "#999" }}>
                          {block.name}
                        </strong>
                        {block.active === false && (
                          <span style={{ marginLeft: "8px", fontSize: "11px", background: "#fed7d7", color: "#9b2c2c", padding: "2px 7px", borderRadius: "20px" }}>
                            Inactive
                          </span>
                        )}
                        {block.active !== false && (
                          <span style={{ marginLeft: "8px", fontSize: "11px", background: "#c6f6d5", color: "#276749", padding: "2px 7px", borderRadius: "20px" }}>
                            Active
                          </span>
                        )}
                      </div>
                      <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                        <button 
                          className="btn btn-secondary" 
                          style={{ padding: "4px 8px", fontSize: "11px" }} 
                          onClick={() => setExpandedBlock(expandedBlock === block._id ? null : block._id)}
                        >
                          {expandedBlock === block._id ? "▲ Sub-blocks" : "▼ Sub-blocks"} ({block.subBlocks?.length || 0})
                        </button>
                        <button 
                          className="btn btn-secondary" 
                          style={{ padding: "4px 8px", fontSize: "11px", background: "#e2e8f0" }} 
                          onClick={() => { 
                            setEditingBlock(block); 
                            setBlockForm({ 
                              name: block.name, 
                              accommodationType: block.accommodationType || "outside_hostel", 
                              usesCategories: block.usesCategories !== false, 
                              description: block.description || "" 
                            }); 
                          }}
                        >
                          ✎ Edit
                        </button>
                        <button 
                          className="btn btn-secondary" 
                          style={{ padding: "4px 8px", fontSize: "11px", background: block.active !== false ? "#fefcbf" : "#c6f6d5" }} 
                          onClick={() => toggleBlockActive(block)}
                        >
                          {block.active !== false ? "⏸ Deactivate" : "▶ Activate"}
                        </button>
                        <button 
                          className="btn btn-danger" 
                          style={{ padding: "4px 8px", fontSize: "11px" }} 
                          onClick={() => deleteBlock(block)}
                        >
                          🗑️ Delete
                        </button>
                      </div>
                    </div>

                    {expandedBlock === block._id && (
                      <div style={{ padding: "12px 14px", background: "#fff" }}>
                        <p style={{ fontSize: "12px", color: "#666", margin: "0 0 8px" }}>
                          Sub-blocks inside <strong>{block.name}</strong>:
                        </p>
                        {block.subBlocks?.length === 0 && <p style={{ fontSize: "12px", color: "#999" }}>No sub-blocks yet.</p>}
                        {block.subBlocks?.map((sub) => (
                          <div 
                            key={sub._id} 
                            style={{ 
                              display: "flex", 
                              justifyContent: "space-between", 
                              alignItems: "center", 
                              padding: "6px 10px", 
                              background: sub.active !== false ? "#f8f9fa" : "#fff5f5", 
                              borderRadius: "7px", 
                              marginBottom: "6px", 
                              flexWrap: "wrap", 
                              gap: "6px" 
                            }}
                          >
                            <span style={{ fontSize: "13px", color: sub.active !== false ? "#333" : "#999" }}>
                              {sub.name}
                              {sub.active === false && <span style={{ marginLeft: "6px", fontSize: "11px", color: "#c53030" }}>(inactive)</span>}
                            </span>
                            <div style={{ display: "flex", gap: "5px" }}>
                              <button 
                                className="btn btn-secondary" 
                                style={{ padding: "3px 7px", fontSize: "11px" }} 
                                onClick={() => { setEditingSubBlock(sub); setEditingSubBlockParent(block._id); setSubBlockName(sub.name); }}
                              >
                                ✎ Edit
                              </button>
                              <button 
                                className="btn btn-secondary" 
                                style={{ padding: "3px 7px", fontSize: "11px" }} 
                                onClick={() => toggleSubBlockActive(block._id, sub._id, sub.active)}
                              >
                                {sub.active !== false ? "⏸" : "▶"}
                              </button>
                              <button 
                                className="btn btn-danger" 
                                style={{ padding: "3px 7px", fontSize: "11px" }} 
                                onClick={() => deleteSubBlock(block._id, sub._id, sub.name)}
                              >
                                🗑️
                              </button>
                            </div>
                          </div>
                        ))}
                        <div style={{ display: "flex", gap: "8px", marginTop: "10px" }}>
                          <input 
                            value={subBlockForm[block._id] || ""} 
                            onChange={(e) => setSubBlockForm((f) => ({ ...f, [block._id]: e.target.value }))} 
                            placeholder="New sub-block name" 
                            style={{ width: "200px", marginBottom: 0, padding: "6px 10px", border: "1px solid #ddd", borderRadius: "4px" }} 
                          />
                          <button className="btn btn-primary" style={{ padding: "6px 12px", fontSize: "12px" }} onClick={() => saveSubBlock(block._id)}>
                            + Add
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Subblocks */}
              <div style={{ marginBottom: "18px", padding: "14px", background: "#fff", border: "1px solid #e2e8f0", borderRadius: "8px" }}>
                <h4 style={{ margin: "0 0 10px", fontSize: "14px" }}>🧩 Subblocks</h4>
                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "flex-end" }}>
                  <div>
                    <label style={{ fontSize: "12px", display: "block", marginBottom: "3px" }}>Block *</label>
                    <select 
                      value={editingSubBlock ? editingSubBlockParent : subBlockParent} 
                      onChange={(e) => { 
                        if (editingSubBlock) setEditingSubBlockParent(e.target.value); 
                        else setSubBlockParent(e.target.value); 
                      }} 
                      style={{ width: "210px", marginBottom: 0, padding: "6px 10px", border: "1px solid #ddd", borderRadius: "4px" }}
                    >
                      <option value="">-- Select a Block --</option>
                      {blocks && blocks.length > 0 ? (
                        blocks.map((b) => (
                          <option key={b._id} value={b._id}>
                            {b.name} {b.active === false ? "(Inactive)" : ""}
                          </option>
                        ))
                      ) : (
                        <option value="" disabled>No blocks available. Create one first.</option>
                      )}
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: "12px", display: "block", marginBottom: "3px" }}>Subblock name *</label>
                    <input 
                      value={subBlockName} 
                      onChange={(e) => setSubBlockName(e.target.value)} 
                      placeholder="e.g. Floor 1" 
                      style={{ width: "180px", marginBottom: 0, padding: "6px 10px", border: "1px solid #ddd", borderRadius: "4px" }} 
                    />
                  </div>
                  <button 
                    className="btn btn-primary" 
                    onClick={saveManagedSubBlock}
                    disabled={!subBlockParent && !editingSubBlockParent}
                  >
                    {editingSubBlock ? "Update Subblock" : "+ Add Subblock"}
                  </button>
                  {editingSubBlock && (
                    <button 
                      className="btn btn-secondary" 
                      onClick={() => { 
                        setEditingSubBlock(null); 
                        setEditingSubBlockParent(""); 
                        setSubBlockName(""); 
                      }}
                    >
                      Cancel
                    </button>
                  )}
                </div>
                <p style={{ fontSize: "12px", color: "#666", margin: "8px 0 0" }}>
                  💡 Create a Subblock and assign it to its parent Block.
                </p>
              </div>

              {/* Categories */}
              <div>
                <h4 style={{ margin: "0 0 12px", fontSize: "14px" }}>🏷️ Categories</h4>
                <p style={{ margin: "0 0 12px", color: "#666", fontSize: "12px" }}>
                  Categories are global room types. Assign them to rooms when creating or editing a room.
                </p>
                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "14px", alignItems: "flex-end" }}>
                  <div>
                    <label style={{ fontSize: "12px", display: "block", marginBottom: "3px" }}>Name *</label>
                    <input 
                      value={catForm.name} 
                      onChange={(e) => setCatForm((f) => ({ ...f, name: e.target.value }))} 
                      placeholder="e.g. Standard" 
                      style={{ width: "140px", marginBottom: 0 }} 
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: "12px", display: "block", marginBottom: "3px" }}>Price (RWF) *</label>
                    <input 
                      type="number" 
                      min="1" 
                      value={catForm.price} 
                      onChange={(e) => setCatForm((f) => ({ ...f, price: e.target.value }))} 
                      placeholder="e.g. 35000" 
                      style={{ width: "130px", marginBottom: 0 }} 
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: "12px", display: "block", marginBottom: "3px" }}>Capacity</label>
                    <input 
                      type="number" 
                      min="1" 
                      value={catForm.capacity} 
                      onChange={(e) => setCatForm((f) => ({ ...f, capacity: e.target.value }))} 
                      style={{ width: "80px", marginBottom: 0 }} 
                    />
                  </div>
                  <button className="btn btn-primary" onClick={saveCat}>
                    {editingCat ? "Update" : "+ Add"}
                  </button>
                  {editingCat && (
                    <button 
                      className="btn btn-secondary" 
                      onClick={() => { setEditingCat(null); setCatForm({ name: "", price: "", description: "", capacity: 2 }); }}
                    >
                      ✕
                    </button>
                  )}
                </div>

                {categories.length === 0 && <p style={{ color: "#999", fontSize: "13px" }}>No categories yet.</p>}
                <div style={{ display: "grid", gap: "8px" }}>
                  {categories.map((cat) => (
                    <div 
                      key={cat._id} 
                      style={{ 
                        display: "flex", 
                        justifyContent: "space-between", 
                        alignItems: "center", 
                        gap: "10px", 
                        flexWrap: "wrap", 
                        padding: "10px 12px", 
                        border: "1px solid #e2e8f0", 
                        borderRadius: "8px", 
                        opacity: cat.active ? 1 : 0.55 
                      }}
                    >
                      <div>
                        <strong>{cat.name}</strong>
                        <span style={{ marginLeft: "10px", color: "#666", fontSize: "12px" }}>
                          {Number(cat.price).toLocaleString()} RWF · capacity {cat.capacity}
                        </span>
                        <span style={{ marginLeft: "8px", fontSize: "11px", color: cat.active ? "#276749" : "#9b2c2c" }}>
                          {cat.active ? "Active" : "Inactive"}
                        </span>
                      </div>
                      <div style={{ display: "flex", gap: "5px" }}>
                        <button 
                          className="btn btn-secondary" 
                          style={{ padding: "4px 8px", fontSize: "11px" }} 
                          onClick={() => { setEditingCat(cat); setCatForm({ name: cat.name, price: cat.price, description: cat.description || "", capacity: cat.capacity || 2 }); }}
                        >
                          ✎ Edit
                        </button>
                        <button 
                          className="btn btn-secondary" 
                          style={{ padding: "4px 8px", fontSize: "11px" }} 
                          onClick={() => toggleCatActive(cat)}
                        >
                          {cat.active ? "Deactivate" : "Activate"}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {addRoomError && !showAddRoom && <p className="error" style={{ marginBottom: "16px" }}>⚠️ {addRoomError}</p>}
          {healthResult && (
            <div className="card" style={{ 
              padding: "16px", 
              marginBottom: "20px", 
              background: healthResult.duplicateGroupsFound > 0 || healthResult.merged?.length > 0 ? "#fffaf0" : "#f0fff4", 
              border: `1px solid ${healthResult.duplicateGroupsFound > 0 || healthResult.merged?.length > 0 ? "#f0e0c0" : "#9ae6b4"}` 
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: "12px", flexWrap: "wrap" }}>
                <p style={{ margin: 0, fontSize: "14px" }}>{healthResult.message}</p>
                <button className="btn btn-secondary" style={{ padding: "4px 10px", fontSize: "12px" }} onClick={() => setHealthResult(null)}>
                  ✕
                </button>
              </div>
              {healthResult.dryRun && healthResult.duplicateGroupsFound > 0 && (
                <button className="btn btn-primary" style={{ marginTop: "12px" }} onClick={() => checkRoomHealth(false)} disabled={healthChecking}>
                  {healthChecking ? "Fixing..." : `Fix these ${healthResult.duplicateGroupsFound} duplicate(s) now`}
                </button>
              )}
            </div>
          )}

          {/* Add Room Form */}
          {showAddRoom && (
            <form onSubmit={createRoom} style={{ marginBottom: "20px", padding: "18px", background: "#fffaf0", border: "1px solid #f0e0c0", borderRadius: "12px" }}>
              <h3 style={{ margin: "0 0 6px" }}>{bulkMode ? "Add multiple rooms" : "Add a room"}</h3>
              <p style={{ margin: "0 0 16px", color: "#666", fontSize: "13px" }}>
                Choose a Block and Category to add rooms.
              </p>
              <div style={{ marginBottom: "14px", display: "flex", gap: "8px" }}>
                <button 
                  type="button" 
                  className={bulkMode ? "btn btn-secondary" : "btn btn-primary"} 
                  onClick={() => { setBulkMode(false); setAddRoomError(""); }}
                >
                  Single Room
                </button>
                <button 
                  type="button" 
                  className={bulkMode ? "btn btn-primary" : "btn btn-secondary"} 
                  onClick={() => { setBulkMode(true); setAddRoomError(""); }}
                >
                  Multiple Rooms
                </button>
              </div>
              <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", alignItems: "flex-end" }}>
                <div>
                  <label style={{ display: "block", fontSize: "12px", marginBottom: "4px" }}>Block *</label>
                  <select
                    value={newRoom.hostelSection || ""}
                    onChange={(e) => {
                      const block = blocks.find((b) => b.name === e.target.value);
                      setNewRoom((r) => ({
                        ...r,
                        hostelSection: e.target.value,
                        accommodationType: block?.accommodationType || r.accommodationType,
                        category: r.category
                      }));
                    }}
                    style={{ width: "250px", marginBottom: 0 }}
                    disabled={!blocks.length}
                  >
                    <option value="">{blocks.length ? "-- Select a Block --" : "No blocks configured"}</option>
                    {blocks.filter((b) => b.active !== false).map((b) => (
                      <option key={b._id} value={b.name}>{b.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "12px", marginBottom: "4px" }}>
                    {bulkMode ? "Room numbers" : "Room Number *"}
                  </label>
                  {bulkMode ? (
                    <div>
                      <input 
                        value={bulkRoomNumbers} 
                        onChange={(e) => setBulkRoomNumbers(e.target.value)} 
                        placeholder="101, 102, 103 (optional)" 
                        style={{ width: "230px", marginBottom: "5px" }} 
                      />
                      <div style={{ fontSize: "11px", color: "#777" }}>Or use a starting number below.</div>
                    </div>
                  ) : (
                    <input 
                      value={newRoom.roomNumber} 
                      onChange={(e) => setNewRoom((r) => ({ ...r, roomNumber: e.target.value }))} 
                      placeholder="e.g. 101" 
                      style={{ width: "140px", marginBottom: 0 }} 
                    />
                  )}
                </div>
                {bulkMode && (
                  <>
                    <div>
                      <label style={{ display: "block", fontSize: "12px", marginBottom: "4px" }}>Start number</label>
                      <input 
                        value={bulkStartNumber} 
                        onChange={(e) => setBulkStartNumber(e.target.value.replace(/\D/g, ""))} 
                        placeholder="e.g. 101" 
                        style={{ width: "120px", marginBottom: 0 }} 
                      />
                    </div>
                    <div>
                      <label style={{ display: "block", fontSize: "12px", marginBottom: "4px" }}>How many?</label>
                      <input 
                        type="number" 
                        min="1" 
                        max="200" 
                        value={bulkCount} 
                        onChange={(e) => setBulkCount(e.target.value)} 
                        style={{ width: "90px", marginBottom: 0 }} 
                      />
                    </div>
                  </>
                )}
                {newRoom.accommodationType === "ilpd_building" && (
                  <div>
                    <label style={{ display: "block", fontSize: "12px", marginBottom: "4px" }}>Category *</label>
                    <select 
                      value={newRoom.category} 
                      onChange={(e) => setNewRoom((r) => ({ ...r, category: e.target.value }))} 
                      style={{ width: "130px", marginBottom: 0 }}
                    >
                      {categories.filter((c) => c.active).map((c) => (
                        <option key={c._id || c.name} value={c.name}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                )}
                <div>
                  <label style={{ display: "block", fontSize: "12px", marginBottom: "4px" }}>Price (RWF) *</label>
                  <input 
                    type="number" 
                    min="1" 
                    value={newRoom.price} 
                    onChange={(e) => setNewRoom((r) => ({ ...r, price: e.target.value }))} 
                    placeholder="e.g. 35000" 
                    style={{ width: "160px", marginBottom: 0 }} 
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "12px", marginBottom: "4px" }}>Location *</label>
                  <input 
                    value={newRoom.address} 
                    onChange={(e) => setNewRoom((r) => ({ ...r, address: e.target.value }))} 
                    placeholder="e.g. Nyanza, Southern Province, Rwanda" 
                    style={{ width: "300px", marginBottom: 0 }} 
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "12px", marginBottom: "4px" }}>
                    Room photos (optional, up to {MAX_ROOM_PHOTOS})
                  </label>
                  <input 
                    type="file" 
                    accept="image/jpeg,image/png,image/webp" 
                    multiple 
                    disabled={newRoom.images.length >= MAX_ROOM_PHOTOS} 
                    onChange={(e) => { addRoomPhotos(e.target.files); e.target.value = ""; }} 
                    style={{ width: "280px", marginBottom: 0 }} 
                  />
                </div>
                {newRoom.images.length > 0 && (
                  <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                    {newRoom.images.map((img, i) => (
                      <div key={i} style={{ position: "relative" }}>
                        <img 
                          src={img} 
                          alt={`Room preview ${i + 1}`} 
                          style={{ width: "70px", height: "60px", objectFit: "cover", borderRadius: "8px", border: "1px solid #ddd" }} 
                        />
                        <button 
                          type="button" 
                          onClick={() => removeRoomPhoto(i)} 
                          style={{ 
                            position: "absolute", 
                            top: "-6px", 
                            right: "-6px", 
                            background: "#c53030", 
                            color: "#fff", 
                            border: "none", 
                            borderRadius: "50%", 
                            width: "18px", 
                            height: "18px", 
                            fontSize: "11px", 
                            cursor: "pointer", 
                            lineHeight: "18px", 
                            padding: 0 
                          }}
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <button 
                  className="btn btn-primary" 
                  type={bulkMode ? "button" : "submit"} 
                  onClick={bulkMode ? createBulkRooms : undefined} 
                  disabled={bulkMode ? bulkCreating : addingRoom}
                >
                  {bulkMode ? (bulkCreating ? "Creating..." : "Create Rooms") : (addingRoom ? "Creating..." : "Create Room")}
                </button>
                <button className="btn btn-secondary" type="button" onClick={() => setShowAddRoom(false)}>
                  Cancel
                </button>
              </div>
              {addRoomError && <div style={{ color: "#c53030", fontSize: "13px", marginTop: "12px" }}>{addRoomError}</div>}
            </form>
          )}

          {/* Rooms Table - DELETE ROOM IN STATUS DROPDOWN */}
          <div style={{ overflowX: "auto" }}>
            <table style={styles.table}>
              <thead>
                <tr>
                  {["Room No.", "Block", "Subblock", "Category", "Capacity", "Price", "Status"].map((h) => (
                    <th key={h} style={styles.th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredRooms.map((r) => (
                  <tr key={r._id}>
                    <td style={{ ...styles.td, fontWeight: "700", whiteSpace: "nowrap" }}>Room {r.roomNumber}</td>
                    <td style={styles.td}>{r.hostelSection || "—"}</td>
                    <td style={styles.td}>{r.subBlock || "—"}</td>
                    <td style={styles.td}>{r.category || "—"}</td>
                    <td style={styles.td}>{r.maxGuests ?? "—"}</td>
                    <td style={styles.td}>
                      <PriceEditor room={r} onSave={updateRoomPrice} />
                      <div style={{ fontSize: "11px", color: "#555", fontWeight: "700" }}>
                        / {r.accommodationType === "ilpd_building" ? "night" : "month"}
                      </div>
                    </td>
                    <td style={styles.td}>
                      <select 
                        value={r.status} 
                        onChange={(e) => {
                          if (e.target.value === "delete") {
                            deleteRoom(r._id);
                          } else {
                            updateRoomStatus(r._id, e.target.value);
                          }
                        }} 
                        style={{ 
                          width: "100%", 
                          padding: "4px 8px", 
                          borderRadius: "4px", 
                          border: "1px solid #ddd",
                          fontSize: "13px",
                          backgroundColor: r.status === "available" ? "#c6f6d5" : r.status === "booked" ? "#fed7d7" : "#fefcbf",
                          color: r.status === "available" ? "#276749" : r.status === "booked" ? "#9b2c2c" : "#744210",
                          fontWeight: "600"
                        }}
                      >
                        <option value="available" style={{ backgroundColor: "#c6f6d5", color: "#276749" }}>Available</option>
                        <option value="booked" style={{ backgroundColor: "#fed7d7", color: "#9b2c2c" }}>Booked</option>
                        <option value="maintenance" style={{ backgroundColor: "#fefcbf", color: "#744210" }}>Maintenance</option>
                        <option value="delete" style={{ backgroundColor: "#fed7d7", color: "#9b2c2c", fontWeight: "bold" }}>🗑️ Delete Room</option>
                      </select>
                    </td>
                  </tr>
                ))}
                {filteredRooms.length === 0 && (
                  <tr>
                    <td colSpan="7" style={{ ...styles.td, textAlign: "center", color: "#888", padding: "40px" }}>
                      No rooms found. Use "Add Room" to create the room inventory.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ===== ROOM EDIT MODAL ===== */}
      {editingRoom && (
        <div 
          style={{ 
            position: "fixed", 
            inset: 0, 
            background: "rgba(0,0,0,.55)", 
            zIndex: 3500, 
            display: "flex", 
            alignItems: "center", 
            justifyContent: "center", 
            padding: "20px" 
          }} 
          onClick={() => setEditingRoom(null)}
        >
          <div 
            style={{ 
              background: "#fff", 
              width: "min(520px, 100%)", 
              borderRadius: "14px", 
              padding: "24px", 
              maxHeight: "90vh", 
              overflowY: "auto" 
            }} 
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: "0 0 16px" }}>✎ Edit Room {editingRoom.roomNumber}</h3>
            <div style={{ display: "grid", gap: "12px" }}>
              <div>
                <label style={{ fontSize: "12px", display: "block", marginBottom: "3px" }}>Room Number</label>
                <input 
                  value={editRoomForm.roomNumber || ""} 
                  onChange={(e) => setEditRoomForm((f) => ({ ...f, roomNumber: e.target.value }))} 
                  style={{ width: "100%", marginBottom: 0 }} 
                />
              </div>
              <div>
                <label style={{ fontSize: "12px", display: "block", marginBottom: "3px" }}>Category</label>
                <input 
                  list="edit-room-categories" 
                  value={editRoomForm.category || ""} 
                  onChange={(e) => setEditRoomForm((f) => ({ ...f, category: e.target.value }))} 
                  style={{ width: "100%", marginBottom: 0 }} 
                />
                <datalist id="edit-room-categories">
                  {categories.filter((c) => c.active).map((c) => (
                    <option key={c._id} value={c.name} />
                  ))}
                </datalist>
              </div>
              {knownBlocks.length > 0 && (
                <div>
                  <label style={{ fontSize: "12px", display: "block", marginBottom: "3px" }}>Block</label>
                  <input 
                    list="edit-room-blocks" 
                    value={editRoomForm.hostelSection || ""} 
                    onChange={(e) => setEditRoomForm((f) => ({ ...f, hostelSection: e.target.value }))} 
                    style={{ width: "100%", marginBottom: 0 }} 
                  />
                  <datalist id="edit-room-blocks">
                    {knownBlocks.map((b) => <option key={b} value={b} />)}
                  </datalist>
                </div>
              )}
              <div>
                <label style={{ fontSize: "12px", display: "block", marginBottom: "3px" }}>Sub-block</label>
                <input 
                  value={editRoomForm.subBlock || ""} 
                  onChange={(e) => setEditRoomForm((f) => ({ ...f, subBlock: e.target.value }))} 
                  placeholder="Optional" 
                  style={{ width: "100%", marginBottom: 0 }} 
                />
              </div>
              <div>
                <label style={{ fontSize: "12px", display: "block", marginBottom: "3px" }}>Price (RWF)</label>
                <input 
                  type="number" 
                  min="1" 
                  value={editRoomForm.price || ""} 
                  onChange={(e) => setEditRoomForm((f) => ({ ...f, price: e.target.value }))} 
                  style={{ width: "100%", marginBottom: 0 }} 
                />
              </div>
              <div>
                <label style={{ fontSize: "12px", display: "block", marginBottom: "3px" }}>Location</label>
                <input 
                  value={editRoomForm.address || ""} 
                  onChange={(e) => setEditRoomForm((f) => ({ ...f, address: e.target.value }))} 
                  style={{ width: "100%", marginBottom: 0 }} 
                />
              </div>
              <div>
                <label style={{ fontSize: "12px", display: "block", marginBottom: "3px" }}>Description</label>
                <textarea 
                  value={editRoomForm.description || ""} 
                  onChange={(e) => setEditRoomForm((f) => ({ ...f, description: e.target.value }))} 
                  rows={3} 
                  style={{ width: "100%", borderRadius: "8px", border: "1px solid #ddd", padding: "8px" }} 
                />
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <input 
                  type="checkbox" 
                  id="roomActive" 
                  checked={editRoomForm.active !== false} 
                  onChange={(e) => setEditRoomForm((f) => ({ ...f, active: e.target.checked }))} 
                />
                <label htmlFor="roomActive" style={{ fontSize: "13px" }}>
                  Room is active (visible to clients)
                </label>
              </div>
            </div>
            {editRoomError && <p style={{ color: "#c53030", fontSize: "13px", marginTop: "12px" }}>{editRoomError}</p>}
            <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end", marginTop: "18px" }}>
              <button className="btn btn-secondary" onClick={() => setEditingRoom(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={saveEditRoom} disabled={editRoomSaving}>
                {editRoomSaving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== CLIENTS TAB ===== */}
      {tab === "Clients" && (
        <>
          <div style={{ marginBottom: "16px" }}>
            <input 
              placeholder="🔍 Search by name or email..." 
              value={search} 
              onChange={(e) => setSearch(e.target.value)} 
              style={{ maxWidth: "400px", marginBottom: 0 }} 
            />
            {clientMsg && <span className="success" style={{ marginLeft: "12px" }}>✅ {clientMsg}</span>}
            {clientError && <span className="error" style={{ marginLeft: "12px" }}>⚠️ {clientError}</span>}
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={styles.table}>
              <thead>
                <tr>
                  {["Name", "Role", "Email", "Phone", "Joined", "Total Bookings", "Total Spent"].map((h) => (
                    <th key={h} style={styles.th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {clients
                  .filter((c) => c.name?.toLowerCase().includes(search.toLowerCase()) || c.email?.toLowerCase().includes(search.toLowerCase()))
                  .map((c) => {
                    const clientBookings = bookings.filter((b) => b.client?._id === c._id || b.client?.email === c.email);
                    const totalSpent = clientBookings.filter((b) => b.paymentStatus === "paid").reduce((s, b) => s + b.totalPrice, 0);
                    const isSelf = c._id === currentUserId;
                    return (
                      <tr key={c._id}>
                        <td style={styles.td}><strong>{c.name}</strong></td>
                        <td style={styles.td}>
                          {isSelf ? (
                            <span style={{ background: "#e9d8fd", color: "#553c9a", padding: "4px 10px", borderRadius: "20px", fontSize: "12px", fontWeight: "600" }}>
                              {c.role} (you)
                            </span>
                          ) : (
                            <button
                              title={c.role === "admin" ? "Click to remove admin access" : "Click to make this person an admin"}
                              onClick={() => c.role === "admin"
                                ? askConfirm(`Remove admin access from ${c.name}? They'll become a regular client account.`, () => setClientRole(c._id, "client", c.name))
                                : askConfirm(`Make ${c.name} an admin? They'll get full access to this dashboard.`, () => setClientRole(c._id, "admin", c.name))}
                              style={{ 
                                background: c.role === "admin" ? "#e9d8fd" : "#bee3f8", 
                                color: c.role === "admin" ? "#553c9a" : "#2a69ac", 
                                padding: "4px 10px", 
                                borderRadius: "20px", 
                                fontSize: "12px", 
                                fontWeight: "600", 
                                border: "none", 
                                cursor: "pointer", 
                                textDecoration: "underline dotted" 
                              }}
                            >
                              {c.role} ✎
                            </button>
                          )}
                        </td>
                        <td style={styles.td}>{c.email}</td>
                        <td style={styles.td}>{c.phone || "N/A"}</td>
                        <td style={styles.td}>{new Date(c.createdAt).toDateString()}</td>
                        <td style={styles.td}>{clientBookings.length}</td>
                        <td style={{ ...styles.td, fontWeight: "600", color: "#b8860b" }}>{fmt(totalSpent)}</td>
                      </tr>
                    );
                  })}
                {clients.length === 0 && (
                  <tr>
                    <td colSpan="7" style={{ ...styles.td, textAlign: "center", color: "#888", padding: "40px" }}>
                      No clients registered yet
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ===== GUEST SUPPORT TAB ===== */}
      {tab === "Guest Support" && (
        <>
          <div style={{ marginBottom: "16px", display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap" }}>
            <input 
              placeholder="🔍 Search by concern, client or booking..." 
              value={search} 
              onChange={(e) => setSearch(e.target.value)} 
              style={{ maxWidth: "400px", marginBottom: 0 }} 
            />
            <input 
              placeholder="Filter by room number..." 
              value={concernRoomFilter} 
              onChange={(e) => setConcernRoomFilter(e.target.value)} 
              style={{ maxWidth: "200px", marginBottom: 0 }} 
            />
            {responseMsg && <span className="success">✅ {responseMsg}</span>}
            {responseError && <span className="error">⚠️ {responseError}</span>}
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={styles.table}>
              <thead>
                <tr>
                  {["Client", "Room", "Subject", "Message", "Status", "Response", "Action"].map((h) => (
                    <th key={h} style={styles.th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(() => {
                  const roomFiltered = filteredConcerns.filter((c) => 
                    !concernRoomFilter.trim() || String(c.booking?.room?.roomNumber || "").includes(concernRoomFilter.trim())
                  );
                  const sorted = [...roomFiltered].sort((a, b) => {
                    const ka = a.client?._id || a.client?.email || "";
                    const kb = b.client?._id || b.client?.email || "";
                    return ka === kb ? 0 : ka < kb ? -1 : 1;
                  });
                  if (!sorted.length) {
                    return (
                      <tr>
                        <td colSpan="7" style={{ ...styles.td, textAlign: "center", color: "#888", padding: "40px" }}>
                          No concerns found.
                        </td>
                      </tr>
                    );
                  }
                  return sorted.map((c, i) => {
                    const key = c.client?._id || c.client?.email || "unknown";
                    const prevKey = i > 0 ? (sorted[i - 1].client?._id || sorted[i - 1].client?.email || "unknown") : null;
                    const isFirstOfRun = key !== prevKey;
                    let runLength = 1;
                    if (isFirstOfRun) {
                      for (let j = i + 1; j < sorted.length; j++) {
                        const jKey = sorted[j].client?._id || sorted[j].client?.email || "unknown";
                        if (jKey !== key) break;
                        runLength++;
                      }
                    }
                    return (
                      <tr key={c._id}>
                        {isFirstOfRun && (
                          <td style={styles.td} rowSpan={runLength}>
                            <strong>{c.client?.name || "Client"}</strong>
                            <br />
                            <small style={{ color: "#888" }}>{c.client?.email}</small>
                          </td>
                        )}
                        <td style={styles.td}>
                          {c.booking?.room?.roomNumber ? `Room ${c.booking.room.roomNumber}` : "—"}
                        </td>
                        <td style={styles.td}>{c.subject}</td>
                        <td style={styles.td}>{c.message}</td>
                        <td style={styles.td}>
                          <span style={{ 
                            background: c.status === "open" ? "#fefcbf" : "#c6f6d5", 
                            color: c.status === "open" ? "#744210" : "#276749", 
                            padding: "4px 10px", 
                            borderRadius: "20px", 
                            fontSize: "12px", 
                            fontWeight: "600" 
                          }}>
                            {c.status}
                          </span>
                        </td>
                        <td style={styles.td}>
                          <textarea 
                            value={responseText[c._id] ?? c.response ?? ""} 
                            onChange={(e) => setResponseText((prev) => ({ ...prev, [c._id]: e.target.value }))} 
                            rows="2" 
                            style={{ width: "100%", minWidth: "200px", borderRadius: "8px", border: "1px solid #ddd", padding: "8px" }} 
                          />
                        </td>
                        <td style={styles.td}>
                          <button 
                            className="btn btn-primary" 
                            style={{ minWidth: "70px" }} 
                            onClick={() => updateConcernResponse(c._id, c.response)}
                          >
                            Save
                          </button>
                        </td>
                      </tr>
                    );
                  });
                })()}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ===== SURVEYS TAB ===== */}
      {tab === "Surveys" && (
        <>
          <div className="card" style={{ padding: "16px", marginBottom: "20px" }}>
            <h4 style={{ margin: "0 0 10px" }}>📝 Custom Survey Questions</h4>
            <p style={{ color: "#666", fontSize: "13px", marginBottom: "12px" }}>
              These are the open-ended questions clients see alongside their star rating. Add, remove, or turn off any question — nothing here is fixed by the system.
            </p>
            <div style={{ display: "flex", gap: "8px", marginBottom: "12px", flexWrap: "wrap" }}>
              <input 
                value={newSurveyQuestion} 
                onChange={(e) => setNewSurveyQuestion(e.target.value)} 
                placeholder="e.g. What could we improve about your stay?" 
                style={{ flex: 1, minWidth: "240px", marginBottom: 0 }} 
              />
              <button className="btn btn-primary" onClick={addSurveyQuestion}>+ Add Question</button>
            </div>
            {surveyQuestionMsg && <p style={{ fontSize: "13px", color: "#c53030", marginBottom: "10px" }}>{surveyQuestionMsg}</p>}
            {surveyQuestions.length ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {surveyQuestions.map((q) => (
                  <div 
                    key={q._id} 
                    style={{ 
                      display: "flex", 
                      justifyContent: "space-between", 
                      alignItems: "center", 
                      gap: "10px", 
                      padding: "8px 12px", 
                      background: "#f8f9fa", 
                      borderRadius: "8px", 
                      flexWrap: "wrap" 
                    }}
                  >
                    <span style={{ 
                      fontSize: "13px", 
                      color: q.active ? "#333" : "#aaa", 
                      textDecoration: q.active ? "none" : "line-through" 
                    }}>
                      {q.text}
                    </span>
                    <div style={{ display: "flex", gap: "6px" }}>
                      <button 
                        className="btn btn-secondary" 
                        style={{ padding: "4px 8px", fontSize: "11px" }} 
                        onClick={() => toggleSurveyQuestion(q)}
                      >
                        {q.active ? "Turn Off" : "Turn On"}
                      </button>
                      <button 
                        className="btn btn-danger" 
                        style={{ padding: "4px 8px", fontSize: "11px" }} 
                        onClick={() => askConfirm(
                          `Delete this question permanently? Past answers to it are kept, but it won't be asked again.`, 
                          () => deleteSurveyQuestion(q._id)
                        )}
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ color: "#999", fontSize: "13px" }}>
                No custom questions yet — clients will only be asked for a star rating and comments until you add one.
              </p>
            )}
          </div>

          <div style={{ marginBottom: "16px" }}>
            <input 
              placeholder="🔍 Search by guest or comments..." 
              value={search} 
              onChange={(e) => setSearch(e.target.value)} 
              style={{ maxWidth: "400px", marginBottom: 0 }} 
            />
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={styles.table}>
              <thead>
                <tr>
                  {["Client", "Rating", "Comments", "Question Answers", "Submitted"].map((h) => (
                    <th key={h} style={styles.th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(() => {
                  const sorted = [...filteredSurveys].sort((a, b) => {
                    const ka = a.client?._id || a.client?.email || "";
                    const kb = b.client?._id || b.client?.email || "";
                    return ka === kb ? 0 : ka < kb ? -1 : 1;
                  });
                  if (!sorted.length) {
                    return (
                      <tr>
                        <td colSpan="5" style={{ ...styles.td, textAlign: "center", color: "#888", padding: "40px" }}>
                          No survey responses yet.
                        </td>
                      </tr>
                    );
                  }
                  return sorted.map((s, i) => {
                    const key = s.client?._id || s.client?.email || "unknown";
                    const prevKey = i > 0 ? (sorted[i - 1].client?._id || sorted[i - 1].client?.email || "unknown") : null;
                    const isFirstOfRun = key !== prevKey;
                    let runLength = 1;
                    if (isFirstOfRun) {
                      for (let j = i + 1; j < sorted.length; j++) {
                        const jKey = sorted[j].client?._id || sorted[j].client?.email || "unknown";
                        if (jKey !== key) break;
                        runLength++;
                      }
                    }
                    return (
                      <tr key={s._id}>
                        {isFirstOfRun && (
                          <td style={styles.td} rowSpan={runLength}>
                            <strong>{s.client?.name}</strong>
                            <br />
                            <small style={{ color: "#888" }}>{s.client?.email}</small>
                          </td>
                        )}
                        <td style={styles.td}><strong>{s.rating} / 5</strong></td>
                        <td style={styles.td}>{s.comments || "No comments"}</td>
                        <td style={styles.td}>
                          {s.answers?.length ? s.answers.map((a, ai) => (
                            <div key={ai} style={{ marginBottom: "6px", fontSize: "12px" }}>
                              <strong>{a.question}</strong>
                              <br />
                              {a.answer || <em style={{ color: "#999" }}>No answer</em>}
                            </div>
                          )) : <span style={{ color: "#999", fontSize: "12px" }}>—</span>}
                        </td>
                        <td style={styles.td}>{new Date(s.createdAt).toLocaleDateString()}</td>
                      </tr>
                    );
                  });
                })()}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ===== CONFIRM DIALOG ===== */}
      {confirmDialog && (
        <div 
          style={{ 
            position: "fixed", 
            inset: 0, 
            background: "rgba(0,0,0,.55)", 
            zIndex: 4000, 
            display: "flex", 
            alignItems: "center", 
            justifyContent: "center", 
            padding: "20px" 
          }} 
          onClick={() => setConfirmDialog(null)}
        >
          <div 
            style={{ 
              background: "#fff", 
              width: "min(420px, 100%)", 
              borderRadius: "14px", 
              padding: "22px" 
            }} 
            onClick={(e) => e.stopPropagation()}
          >
            <p style={{ margin: "0 0 20px", fontSize: "14px", color: "#333" }}>
              {confirmDialog.message}
            </p>
            <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
              <button className="btn btn-secondary" onClick={() => setConfirmDialog(null)}>
                Cancel
              </button>
              <button 
                className="btn btn-primary" 
                onClick={() => { 
                  const action = confirmDialog.onConfirm; 
                  setConfirmDialog(null); 
                  action(); 
                }}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}