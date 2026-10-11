"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import sheetData from "@/data/strivers_sde_sheet.json";

export default function SdeSheetPage() {
  // User Authentication & Cloud Sync
  const [currentUser, setCurrentUser] = useState(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authEmail, setAuthEmail] = useState("");
  const [authStep, setAuthStep] = useState("email"); // 'email' | 'otp'
  const [otpCode, setOtpCode] = useState(["", "", "", "", "", ""]);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState("");
  const [devOtpReceived, setDevOtpReceived] = useState(null);

  // Sheet Progress states
  const [doneIds, setDoneIds] = useState(new Set());
  const [starredIds, setStarredIds] = useState(new Set());
  const [notes, setNotes] = useState({});
  const [openSections, setOpenSections] = useState(new Set(["612"])); // Default open Arrays section
  const [isLoaded, setIsLoaded] = useState(false);

  // Filter and search states
  const [activeTab, setActiveTab] = useState("all"); // 'all' | 'revision'
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all"); // 'all' | 'done' | 'incomplete'
  const [difficultyFilter, setDifficultyFilter] = useState("all"); // 'all' | 'Easy' | 'Medium' | 'Hard'
  
  // UI interaction states
  const [activeNoteProblem, setActiveNoteProblem] = useState(null);
  const [currentNoteText, setCurrentNoteText] = useState("");
  const [highlightedProblemId, setHighlightedProblemId] = useState(null);
  const [toastMessage, setToastMessage] = useState(null);
  const [showResetModal, setShowResetModal] = useState(false);
  const [showKnowMore, setShowKnowMore] = useState(false);

  const fileInputRef = useRef(null);
  const otpInputRefs = useRef([]);
  const syncTimeoutRef = useRef(null);

  // Utility to show toast message
  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3000);
  };

  // Sync progress to cloud database
  const syncToCloud = useCallback(async (currentDone, currentStarred, currentNotes) => {
    if (!currentUser) return;
    try {
      setIsSyncing(true);
      const res = await fetch("/api/progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          done: Array.from(currentDone),
          starred: Array.from(currentStarred),
          notes: currentNotes,
        }),
      });
      if (res.ok) {
        // Sync complete
      }
    } catch (e) {
      console.error("Cloud sync error:", e);
    } finally {
      setTimeout(() => setIsSyncing(false), 600);
    }
  }, [currentUser]);

  // Load from localStorage and check user session on mount
  useEffect(() => {
    let localDone = new Set();
    let localStarred = new Set();
    let localNotes = {};

    try {
      const savedDone = localStorage.getItem("tuf_sde_done");
      if (savedDone) localDone = new Set(JSON.parse(savedDone));

      const savedStarred = localStorage.getItem("tuf_sde_starred");
      if (savedStarred) localStarred = new Set(JSON.parse(savedStarred));

      const savedNotes = localStorage.getItem("tuf_sde_notes");
      if (savedNotes) localNotes = JSON.parse(savedNotes);

      const savedOpenSections = localStorage.getItem("tuf_sde_open_sections");
      if (savedOpenSections) {
        setOpenSections(new Set(JSON.parse(savedOpenSections)));
      } else {
        const initial = new Set(sheetData.sections.slice(0, 3).map((s) => s.category_id));
        setOpenSections(initial);
      }
    } catch (e) {
      console.error("Failed to read localStorage:", e);
    }

    setDoneIds(localDone);
    setStarredIds(localStarred);
    setNotes(localNotes);

    // Check user session
    fetch("/api/auth/me")
      .then((res) => res.json())
      .then((data) => {
        if (data.user) {
          setCurrentUser(data.user);
          if (data.progress) {
            // Merge cloud and local data
            const mergedDone = new Set([...(data.progress.done || []), ...Array.from(localDone)]);
            const mergedStarred = new Set([...(data.progress.starred || []), ...Array.from(localStarred)]);
            const mergedNotes = { ...(data.progress.notes || {}), ...localNotes };

            setDoneIds(mergedDone);
            setStarredIds(mergedStarred);
            setNotes(mergedNotes);

            // Persist back to cloud if local had extra
            syncToCloud(mergedDone, mergedStarred, mergedNotes);
          }
        }
      })
      .catch((err) => console.error("Session check failed:", err))
      .finally(() => {
        setIsLoaded(true);
      });
  }, [syncToCloud]);

  // Save to localStorage
  useEffect(() => {
    if (!isLoaded) return;
    try {
      localStorage.setItem("tuf_sde_done", JSON.stringify(Array.from(doneIds)));
    } catch (e) {}
  }, [doneIds, isLoaded]);

  useEffect(() => {
    if (!isLoaded) return;
    try {
      localStorage.setItem("tuf_sde_starred", JSON.stringify(Array.from(starredIds)));
    } catch (e) {}
  }, [starredIds, isLoaded]);

  useEffect(() => {
    if (!isLoaded) return;
    try {
      localStorage.setItem("tuf_sde_notes", JSON.stringify(notes));
    } catch (e) {}
  }, [notes, isLoaded]);

  useEffect(() => {
    if (!isLoaded) return;
    try {
      localStorage.setItem("tuf_sde_open_sections", JSON.stringify(Array.from(openSections)));
    } catch (e) {}
  }, [openSections, isLoaded]);

  // Debounced cloud sync whenever progress state updates
  useEffect(() => {
    if (!isLoaded || !currentUser) return;
    if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);

    syncTimeoutRef.current = setTimeout(() => {
      syncToCloud(doneIds, starredIds, notes);
    }, 1200);

    return () => {
      if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
    };
  }, [doneIds, starredIds, notes, currentUser, isLoaded, syncToCloud]);

  // Toggle problem done status
  const toggleDone = (problemId, e) => {
    if (e) e.stopPropagation();
    setDoneIds((prev) => {
      const next = new Set(prev);
      if (next.has(problemId)) {
        next.delete(problemId);
        showToast("Problem marked as uncompleted");
      } else {
        next.add(problemId);
        showToast("Problem completed! 🎉");
      }
      return next;
    });
  };

  // Toggle problem starred status
  const toggleStarred = (problemId, e) => {
    if (e) e.stopPropagation();
    setStarredIds((prev) => {
      const next = new Set(prev);
      if (next.has(problemId)) {
        next.delete(problemId);
        showToast("Removed from revision");
      } else {
        next.add(problemId);
        showToast("Added to revision list ⭐");
      }
      return next;
    });
  };

  // Toggle section open/close
  const toggleSection = (categoryId) => {
    setOpenSections((prev) => {
      const next = new Set(prev);
      if (next.has(categoryId)) {
        next.delete(categoryId);
      } else {
        next.add(categoryId);
      }
      return next;
    });
  };

  const expandAll = () => {
    const allIds = new Set(sheetData.sections.map((s) => s.category_id));
    setOpenSections(allIds);
  };

  const collapseAll = () => {
    setOpenSections(new Set());
  };

  // Open note editor
  const handleOpenNote = (problem, e) => {
    if (e) e.stopPropagation();
    setActiveNoteProblem(problem);
    setCurrentNoteText(notes[problem.problem_id] || "");
  };

  const handleSaveNote = () => {
    if (!activeNoteProblem) return;
    setNotes((prev) => ({
      ...prev,
      [activeNoteProblem.problem_id]: currentNoteText.trim(),
    }));
    setActiveNoteProblem(null);
    showToast("Notes saved successfully");
  };

  // Random problem selector
  const handleRandomProblem = () => {
    const allProblems = [];
    sheetData.sections.forEach((sec) => {
      sec.problems.forEach((p) => {
        allProblems.push({ ...p, category_id: sec.category_id });
      });
    });

    let candidates = allProblems.filter((p) => !doneIds.has(p.problem_id));
    if (candidates.length === 0) candidates = allProblems;

    if (candidates.length === 0) return;

    const randomIndex = Math.floor(Math.random() * candidates.length);
    const chosen = candidates[randomIndex];

    setOpenSections((prev) => {
      const next = new Set(prev);
      next.add(chosen.category_id);
      return next;
    });

    if (activeTab === "revision" && !starredIds.has(chosen.problem_id)) {
      setActiveTab("all");
    }
    if (statusFilter === "done" && !doneIds.has(chosen.problem_id)) {
      setStatusFilter("all");
    }
    if (difficultyFilter !== "all" && chosen.difficulty !== difficultyFilter) {
      setDifficultyFilter("all");
    }
    setSearchQuery("");

    setHighlightedProblemId(chosen.problem_id);
    showToast(`Picked: ${chosen.problem_name}`);

    setTimeout(() => {
      const el = document.getElementById(`problem-row-${chosen.problem_id}`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }, 150);

    setTimeout(() => {
      setHighlightedProblemId(null);
    }, 3500);
  };

  // Reset all progress
  const handleResetProgress = () => {
    const emptyDone = new Set();
    const emptyStarred = new Set();
    const emptyNotes = {};

    setDoneIds(emptyDone);
    setStarredIds(emptyStarred);
    setNotes(emptyNotes);

    localStorage.removeItem("tuf_sde_done");
    localStorage.removeItem("tuf_sde_starred");
    localStorage.removeItem("tuf_sde_notes");

    if (currentUser) {
      syncToCloud(emptyDone, emptyStarred, emptyNotes);
    }

    setShowResetModal(false);
    showToast("All progress has been reset");
  };

  // Export progress
  const handleExportData = () => {
    const data = {
      exportDate: new Date().toISOString(),
      user: currentUser?.email || "anonymous",
      done: Array.from(doneIds),
      starred: Array.from(starredIds),
      notes: notes,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `strivers_sde_sheet_progress_${new Date().toISOString().split("T")[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast("Progress exported successfully!");
  };

  // Import progress
  const handleImportData = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target.result);
        const importedDone = parsed.done ? new Set(parsed.done) : doneIds;
        const importedStarred = parsed.starred ? new Set(parsed.starred) : starredIds;
        const importedNotes = parsed.notes ? parsed.notes : notes;

        setDoneIds(importedDone);
        setStarredIds(importedStarred);
        setNotes(importedNotes);

        if (currentUser) {
          syncToCloud(importedDone, importedStarred, importedNotes);
        }

        showToast("Progress imported successfully!");
      } catch (err) {
        alert("Failed to parse the uploaded file. Please make sure it's valid JSON.");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  // Send OTP handler
  const handleSendOtp = async (e) => {
    e.preventDefault();
    if (!authEmail.trim() || !authEmail.includes("@")) {
      setAuthError("Please enter a valid email address.");
      return;
    }

    setAuthLoading(true);
    setAuthError("");
    try {
      const res = await fetch("/api/auth/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: authEmail.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setAuthError(data.error || "Failed to send OTP.");
      } else {
        setAuthStep("otp");
        if (data.devOtp) {
          setDevOtpReceived(data.devOtp);
        }
        showToast("Verification code sent! Check your email.");
      }
    } catch (err) {
      setAuthError("Network error. Please try again.");
    } finally {
      setAuthLoading(false);
    }
  };

  // Verify OTP handler
  const handleVerifyOtp = async (codeToVerify) => {
    const code = codeToVerify || otpCode.join("");
    if (code.length !== 6) {
      setAuthError("Please enter the complete 6-digit verification code.");
      return;
    }

    setAuthLoading(true);
    setAuthError("");
    try {
      const res = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: authEmail.trim(), code }),
      });
      const data = await res.json();
      if (!res.ok) {
        setAuthError(data.error || "Invalid or expired code.");
      } else {
        setCurrentUser(data.user);
        setShowAuthModal(false);
        setAuthStep("email");
        setOtpCode(["", "", "", "", "", ""]);
        setDevOtpReceived(null);

        // Merge cloud data with existing local progress
        if (data.progress) {
          const mergedDone = new Set([...(data.progress.done || []), ...Array.from(doneIds)]);
          const mergedStarred = new Set([...(data.progress.starred || []), ...Array.from(starredIds)]);
          const mergedNotes = { ...(data.progress.notes || {}), ...notes };

          setDoneIds(mergedDone);
          setStarredIds(mergedStarred);
          setNotes(mergedNotes);

          // Save combined state to cloud
          syncToCloud(mergedDone, mergedStarred, mergedNotes);
        }
        showToast(`Welcome back, ${data.user.email}! 🚀`);
      }
    } catch (err) {
      setAuthError("Network error. Please try again.");
    } finally {
      setAuthLoading(false);
    }
  };

  // OTP input handling
  const handleOtpChange = (index, value) => {
    if (!/^\d*$/.test(value)) return;

    const newOtp = [...otpCode];
    newOtp[index] = value.slice(-1);
    setOtpCode(newOtp);

    // Auto-focus next input
    if (value && index < 5) {
      otpInputRefs.current[index + 1]?.focus();
    }

    // Auto-submit if all 6 digits entered
    const fullCode = newOtp.join("");
    if (fullCode.length === 6 && !newOtp.includes("")) {
      handleVerifyOtp(fullCode);
    }
  };

  const handleOtpKeyDown = (index, e) => {
    if (e.key === "Backspace" && !otpCode[index] && index > 0) {
      otpInputRefs.current[index - 1]?.focus();
    }
  };

  const handleOtpPaste = (e) => {
    e.preventDefault();
    const paste = e.clipboardData.getData("text").trim();
    if (/^\d{6}$/.test(paste)) {
      const digits = paste.split("");
      setOtpCode(digits);
      handleVerifyOtp(paste);
    }
  };

  // Sign out handler
  const handleSignOut = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      setCurrentUser(null);
      showToast("Signed out. Local progress retained.");
    } catch (e) {
      console.error(e);
    }
  };

  // Aggregate statistics
  const stats = useMemo(() => {
    let totalProblems = 0;
    let completedTotal = 0;

    let easyTotal = 0;
    let easyCompleted = 0;

    let mediumTotal = 0;
    let mediumCompleted = 0;

    let hardTotal = 0;
    let hardCompleted = 0;

    sheetData.sections.forEach((sec) => {
      sec.problems.forEach((p) => {
        totalProblems++;
        const isDone = doneIds.has(p.problem_id);
        if (isDone) completedTotal++;

        if (p.difficulty === "Easy") {
          easyTotal++;
          if (isDone) easyCompleted++;
        } else if (p.difficulty === "Medium") {
          mediumTotal++;
          if (isDone) mediumCompleted++;
        } else if (p.difficulty === "Hard") {
          hardTotal++;
          if (isDone) hardCompleted++;
        }
      });
    });

    const overallPercentage = totalProblems > 0 ? Math.round((completedTotal / totalProblems) * 100) : 0;

    return {
      total: totalProblems,
      completedTotal,
      overallPercentage,
      easyTotal,
      easyCompleted,
      mediumTotal,
      mediumCompleted,
      hardTotal,
      hardCompleted,
      starredTotal: starredIds.size,
    };
  }, [doneIds, starredIds]);

  // Filtered sections and problems
  const filteredSections = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return sheetData.sections
      .map((sec) => {
        const filteredProblems = sec.problems.filter((p) => {
          if (activeTab === "revision" && !starredIds.has(p.problem_id)) {
            return false;
          }
          if (statusFilter === "done" && !doneIds.has(p.problem_id)) {
            return false;
          }
          if (statusFilter === "incomplete" && doneIds.has(p.problem_id)) {
            return false;
          }
          if (difficultyFilter !== "all" && p.difficulty !== difficultyFilter) {
            return false;
          }
          if (query) {
            const matchesName = p.problem_name.toLowerCase().includes(query);
            const matchesSec = sec.category_name.toLowerCase().includes(query);
            if (!matchesName && !matchesSec) return false;
          }
          return true;
        });

        const totalInSec = sec.problems.length;
        const completedInSec = sec.problems.filter((p) => doneIds.has(p.problem_id)).length;

        return {
          ...sec,
          problems: filteredProblems,
          totalInSec,
          completedInSec,
        };
      })
      .filter((sec) => sec.problems.length > 0 || (searchQuery === "" && activeTab === "all" && statusFilter === "all" && difficultyFilter === "all"));
  }, [activeTab, statusFilter, difficultyFilter, searchQuery, doneIds, starredIds]);

  const circleRadius = 24;
  const circleCircumference = 2 * Math.PI * circleRadius;
  const strokeDashoffset = circleCircumference - (stats.overallPercentage / 100) * circleCircumference;

  return (
    <div className="app-layout">
      {/* Left Sidebar */}
      <aside className="sidebar">
        <div className="logo-container">
          <div className="tuf-logo-badge" title="Take U Forward">
            t<span>u</span>f
          </div>
        </div>

        <nav className="nav-links">
          <button className="nav-item" title="Home" onClick={() => showToast("Classic Striver's Sheet")}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              <polyline points="9 22 9 12 15 12 15 22" />
            </svg>
            <span>Home</span>
          </button>

          <button className="nav-item" title="Plus" onClick={() => showToast("TakeUForward Classic Edition")}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
            </svg>
            <span>Plus</span>
          </button>

          <button className="nav-item active" title="SDE Sheet">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
              <polyline points="10 9 9 9 8 9" />
            </svg>
            <span>Sheet</span>
          </button>
        </nav>

        <div className="sidebar-bottom">
          <button className="icon-btn-ghost" title="Export Progress (JSON)" onClick={handleExportData}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
          </button>

          <button className="icon-btn-ghost" title="Import Progress" onClick={() => fileInputRef.current?.click()}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
          </button>
          <input type="file" ref={fileInputRef} onChange={handleImportData} accept=".json" style={{ display: "none" }} />

          <button className="icon-btn-ghost" title="Reset All Progress" onClick={() => setShowResetModal(true)}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
              <path d="M21 3v5h-5" />
              <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
              <path d="M3 21v-5h5" />
            </svg>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="main-wrapper">
        {/* Header Section */}
        <header className="page-header">
          <div className="header-top-row">
            <h1 className="page-title">{sheetData.title}</h1>
            
            <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
              <div className="last-updated-badge">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
                <span>Last updated : {sheetData.lastUpdated}</span>
              </div>

              {/* User Authentication Status */}
              <div className="user-auth-bar">
                {currentUser ? (
                  <>
                    <span className={`cloud-sync-pill ${isSyncing ? "syncing" : ""}`}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z" />
                      </svg>
                      {isSyncing ? "Syncing..." : "Cloud Synced"}
                    </span>
                    <div className="user-profile-btn" title={currentUser.email}>
                      <div className="user-avatar-circle">
                        {currentUser.email[0]}
                      </div>
                      <span style={{ maxWidth: "140px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {currentUser.email.split("@")[0]}
                      </span>
                      <button className="btn-signout" onClick={handleSignOut} title="Sign Out">
                        Sign Out
                      </button>
                    </div>
                  </>
                ) : (
                  <button className="btn-signin" onClick={() => { setShowAuthModal(true); setAuthStep("email"); setAuthError(""); }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
                      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                    </svg>
                    <span>Sign In & Sync</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          <p className="page-description">
            {sheetData.description}.
            <span className="description-link" onClick={() => setShowKnowMore(!showKnowMore)}>
              {showKnowMore ? "Show less" : "Know more"}
            </span>
          </p>

          {showKnowMore && (
            <div style={{ marginTop: "12px", padding: "14px 18px", background: "#f8fafc", borderRadius: "10px", border: "1px solid #e2e8f0", fontSize: "13.5px", color: "#475569" }}>
              <strong style={{ color: "#0f172a" }}>💡 Tips for cracking top tech interviews:</strong>
              <ul style={{ paddingLeft: "20px", marginTop: "6px", display: "flex", flexDirection: "column", gap: "4px" }}>
                <li>Do not jump straight to the code. Spend 10-15 minutes understanding edge cases, brute force, and optimal logic.</li>
                <li>Mark problems for <strong>Revision ⭐</strong> that took you more than 30 minutes to solve or where the pattern was tricky.</li>
                <li><strong>Cloud Sync ☁️:</strong> Sign in with just your email and OTP to synchronize your progress across all your devices securely on Vercel Postgres / Neon!</li>
              </ul>
            </div>
          )}
        </header>

        {/* Toolbar & Filter Bar */}
        <div className="toolbar-container">
          <div className="tab-group">
            <button
              className={`tab-btn ${activeTab === "all" ? "active" : ""}`}
              onClick={() => setActiveTab("all")}
            >
              All Problems
              <span className="tab-counter">{stats.total}</span>
            </button>
            <button
              className={`tab-btn ${activeTab === "revision" ? "active" : ""}`}
              onClick={() => setActiveTab("revision")}
            >
              Revision
              <span className="tab-counter">{stats.starredTotal}</span>
            </button>
          </div>

          <div className="toolbar-controls">
            {/* Search Box */}
            <div className="search-box">
              <svg className="search-icon-left" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                type="text"
                className="search-input"
                placeholder="Search problems..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <span className="search-clear-btn" onClick={() => setSearchQuery("")} title="Clear search">
                  ✕
                </span>
              )}
            </div>

            {/* Status Filter */}
            <select
              className="select-filter"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="all">All problems</option>
              <option value="done">Completed</option>
              <option value="incomplete">Incomplete</option>
            </select>

            {/* Difficulty Filter */}
            <select
              className="select-filter"
              value={difficultyFilter}
              onChange={(e) => setDifficultyFilter(e.target.value)}
            >
              <option value="all">Difficulty</option>
              <option value="Easy">Easy</option>
              <option value="Medium">Medium</option>
              <option value="Hard">Hard</option>
            </select>

            {/* Random Problem Button */}
            <button className="btn-secondary" onClick={handleRandomProblem} title="Pick a random problem to solve">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="16 3 21 3 21 8" />
                <line x1="4" y1="20" x2="21" y2="3" />
                <polyline points="21 16 21 21 16 21" />
                <line x1="15" y1="15" x2="21" y2="21" />
                <line x1="4" y1="4" x2="9" y2="9" />
              </svg>
              <span>Random Problem</span>
            </button>
          </div>
        </div>

        {/* Overall Progress Card */}
        <section className="progress-card">
          <div className="progress-left">
            <div className="progress-circular-badge">
              <svg>
                <circle
                  className="progress-circle-bg"
                  cx="30"
                  cy="30"
                  r={circleRadius}
                />
                <circle
                  className="progress-circle-fill"
                  cx="30"
                  cy="30"
                  r={circleRadius}
                  style={{
                    strokeDasharray: circleCircumference,
                    strokeDashoffset: strokeDashoffset,
                  }}
                />
              </svg>
              <span className="progress-percentage-text">{stats.overallPercentage}%</span>
            </div>

            <div className="progress-details">
              <span className="progress-title">Overall Progress</span>
              <div className="progress-numbers">
                {stats.completedTotal} <span>/ {stats.total}</span>
              </div>
            </div>
          </div>

          <div className="difficulty-counters">
            <div className="diff-counter-item">
              <span className="diff-dot easy" />
              <span className="diff-label">Easy</span>
              <span className="diff-count">
                {stats.easyCompleted} <span>/ {stats.easyTotal}</span>
              </span>
            </div>

            <div className="diff-counter-item">
              <span className="diff-dot medium" />
              <span className="diff-label">Medium</span>
              <span className="diff-count">
                {stats.mediumCompleted} <span>/ {stats.mediumTotal}</span>
              </span>
            </div>

            <div className="diff-counter-item">
              <span className="diff-dot hard" />
              <span className="diff-label">Hard</span>
              <span className="diff-count">
                {stats.hardCompleted} <span>/ {stats.hardTotal}</span>
              </span>
            </div>
          </div>
        </section>

        {/* Section List Header */}
        <div className="sections-header-bar">
          <span className="sections-count-info">
            Showing {filteredSections.reduce((acc, s) => acc + s.problems.length, 0)} problems across {filteredSections.length} sections
          </span>
          <div style={{ display: "flex", gap: "14px" }}>
            <span className="sections-expand-toggle" onClick={expandAll}>
              Expand all
            </span>
            <span style={{ color: "#cbd5e1" }}>•</span>
            <span className="sections-expand-toggle" onClick={collapseAll}>
              Collapse all
            </span>
          </div>
        </div>

        {/* Accordion Sections */}
        <div className="sections-list">
          {filteredSections.map((section) => {
            const isOpen = openSections.has(section.category_id);
            const totalProblems = section.totalInSec;
            const completedProblems = section.completedInSec;
            const progressPercent = totalProblems > 0 ? (completedProblems / totalProblems) * 100 : 0;

            return (
              <div key={section.category_id} className={`accordion-card ${isOpen ? "is-open" : ""}`}>
                {/* Header */}
                <div
                  className="accordion-header"
                  onClick={() => toggleSection(section.category_id)}
                >
                  <div className="accordion-header-left">
                    <span className={`accordion-chevron ${isOpen ? "open" : ""}`}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="9 18 15 12 9 6" />
                      </svg>
                    </span>
                    <h2 className="accordion-title">{section.category_name}</h2>
                  </div>

                  <div className="accordion-header-right">
                    <div className="accordion-progress-track">
                      <div
                        className={`accordion-progress-fill ${progressPercent === 100 ? "completed" : ""}`}
                        style={{ width: `${progressPercent}%` }}
                      />
                    </div>
                    <span className="accordion-counter">
                      {completedProblems} <span>/ {totalProblems}</span>
                    </span>
                  </div>
                </div>

                {/* Body Table */}
                {isOpen && (
                  <div className="table-container">
                    <table className="problems-table">
                      <thead>
                        <tr>
                          <th className="col-status">Status</th>
                          <th className="col-star">Star</th>
                          <th className="col-problem">Problem</th>
                          <th className="col-difficulty">Difficulty</th>
                          <th className="col-article">Article</th>
                          <th className="col-youtube">YouTube</th>
                          <th className="col-practice">Practice</th>
                          <th className="col-notes">Notes</th>
                        </tr>
                      </thead>
                      <tbody>
                        {section.problems.map((problem, pIndex) => {
                          const isDone = doneIds.has(problem.problem_id);
                          const isStarred = starredIds.has(problem.problem_id);
                          const hasNotes = Boolean(notes[problem.problem_id]);
                          const isHighlighted = highlightedProblemId === problem.problem_id;
                          const difficultyClass = problem.difficulty ? problem.difficulty.toLowerCase() : "unknown";

                          return (
                            <tr
                              key={problem.problem_id}
                              id={`problem-row-${problem.problem_id}`}
                              className={`problem-row ${isDone ? "is-done" : ""} ${isHighlighted ? "highlight-problem" : ""}`}
                            >
                              {/* Status Checkbox */}
                              <td className="col-status">
                                <button
                                  className={`status-checkbox-btn ${isDone ? "checked" : ""}`}
                                  onClick={(e) => toggleDone(problem.problem_id, e)}
                                  title={isDone ? "Mark as uncompleted" : "Mark as completed"}
                                >
                                  {isDone && (
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                      <polyline points="20 6 9 17 4 12" />
                                    </svg>
                                  )}
                                </button>
                              </td>

                              {/* Revision Star */}
                              <td className="col-star">
                                <button
                                  className={`star-toggle-btn ${isStarred ? "starred" : ""}`}
                                  onClick={(e) => toggleStarred(problem.problem_id, e)}
                                  title={isStarred ? "Remove revision star" : "Mark for revision"}
                                >
                                  <svg width="18" height="18" viewBox="0 0 24 24" fill={isStarred ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                                  </svg>
                                </button>
                              </td>

                              {/* Problem Title */}
                              <td className="col-problem">
                                <div className="problem-title-cell">
                                  <span className="problem-index-num">{pIndex + 1}.</span>
                                  <a
                                    href={problem.leetcode || problem.article || problem.editorial || "#"}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="problem-title-link problem-title-text"
                                    title={problem.problem_name}
                                  >
                                    {problem.problem_name}
                                  </a>
                                </div>
                              </td>

                              {/* Difficulty */}
                              <td className="col-difficulty">
                                <span className={`difficulty-badge ${difficultyClass}`}>
                                  {problem.difficulty || "Medium"}
                                </span>
                              </td>

                              {/* Article */}
                              <td className="col-article">
                                {problem.article ? (
                                  <a
                                    href={problem.article}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="resource-btn article"
                                    title="Read TakeUForward Article"
                                  >
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                      <polyline points="14 2 14 8 20 8" />
                                      <line x1="16" y1="13" x2="8" y2="13" />
                                      <line x1="16" y1="17" x2="8" y2="17" />
                                      <polyline points="10 9 9 9 8 9" />
                                    </svg>
                                  </a>
                                ) : (
                                  <span className="resource-btn disabled" title="No article available">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                      <line x1="18" y1="6" x2="6" y2="18" />
                                      <line x1="6" y1="6" x2="18" y2="18" />
                                    </svg>
                                  </span>
                                )}
                              </td>

                              {/* YouTube */}
                              <td className="col-youtube">
                                {problem.youtube ? (
                                  <a
                                    href={problem.youtube}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="resource-btn youtube"
                                    title="Watch YouTube Solution"
                                  >
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                                      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                                    </svg>
                                  </a>
                                ) : (
                                  <span className="resource-btn disabled" title="No video available">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                      <line x1="18" y1="6" x2="6" y2="18" />
                                      <line x1="6" y1="6" x2="18" y2="18" />
                                    </svg>
                                  </span>
                                )}
                              </td>

                              {/* Practice */}
                              <td className="col-practice">
                                {problem.leetcode ? (
                                  <a
                                    href={problem.leetcode}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="resource-btn practice"
                                    title="Solve on LeetCode"
                                  >
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                      <polyline points="16 18 22 12 16 6" />
                                      <polyline points="8 6 2 12 8 18" />
                                    </svg>
                                  </a>
                                ) : (
                                  <span className="resource-btn disabled" title="No external practice link">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                      <polyline points="16 18 22 12 16 6" />
                                      <polyline points="8 6 2 12 8 18" />
                                    </svg>
                                  </span>
                                )}
                              </td>

                              {/* Notes */}
                              <td className="col-notes">
                                <button
                                  className={`resource-btn ${hasNotes ? "has-notes" : ""}`}
                                  onClick={(e) => handleOpenNote(problem, e)}
                                  title={hasNotes ? "View/Edit Notes" : "Add Personal Notes"}
                                >
                                  <svg width="16" height="16" viewBox="0 0 24 24" fill={hasNotes ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M12 20h9" />
                                    <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                                  </svg>
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}

          {filteredSections.length === 0 && (
            <div className="empty-state">
              <svg className="empty-state-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <h3 className="empty-state-title">No problems match your filters</h3>
              <p className="empty-state-text">
                Try clearing your search query or switching your status/difficulty filters.
              </p>
              <button
                className="btn-secondary"
                style={{ marginTop: "16px" }}
                onClick={() => {
                  setSearchQuery("");
                  setStatusFilter("all");
                  setDifficultyFilter("all");
                  setActiveTab("all");
                }}
              >
                Reset Filters
              </button>
            </div>
          )}
        </div>
      </main>

      {/* Authentication Modal (Email + OTP) */}
      {showAuthModal && (
        <div
          className="modal-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget && !authLoading) setShowAuthModal(false);
          }}
        >
          <div className="modal-dialog">
            <div className="modal-header">
              <h3 className="modal-title">
                {authStep === "email" ? "Sign in to Sync Progress" : "Enter Verification Code"}
              </h3>
              <button className="modal-close-btn" onClick={() => !authLoading && setShowAuthModal(false)}>
                ✕
              </button>
            </div>

            <div className="modal-body">
              {authStep === "email" ? (
                <form onSubmit={handleSendOtp}>
                  <div className="auth-input-group">
                    <label className="auth-label">Email Address</label>
                    <input
                      type="email"
                      className="auth-input"
                      placeholder="your.email@example.com"
                      value={authEmail}
                      onChange={(e) => setAuthEmail(e.target.value)}
                      required
                      autoFocus
                    />
                    <p className="auth-hint-text">
                      We will send a 6-digit one-time passcode to your email. No passwords needed.
                    </p>
                  </div>

                  {authError && (
                    <p style={{ color: "#dc2626", fontSize: "13.5px", marginBottom: "14px" }}>
                      ⚠️ {authError}
                    </p>
                  )}

                  <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => setShowAuthModal(false)}
                      disabled={authLoading}
                    >
                      Cancel
                    </button>
                    <button type="submit" className="btn-primary" disabled={authLoading}>
                      {authLoading ? "Sending Code..." : "Send Login Code"}
                    </button>
                  </div>
                </form>
              ) : (
                <div>
                  <p style={{ color: "#475569", fontSize: "14px", marginBottom: "16px" }}>
                    We sent a 6-digit code to <strong>{authEmail}</strong>.
                    <span
                      style={{ color: "#ea580c", cursor: "pointer", marginLeft: "6px", fontWeight: 600 }}
                      onClick={() => setAuthStep("email")}
                    >
                      Change
                    </span>
                  </p>

                  {/* Dev Mode OTP auto-fill banner */}
                  {devOtpReceived && (
                    <div className="dev-otp-banner">
                      <span>Dev Mode OTP: <span className="dev-otp-code">{devOtpReceived}</span></span>
                      <button
                        className="btn-outline-action"
                        type="button"
                        onClick={() => {
                          const digits = devOtpReceived.split("");
                          setOtpCode(digits);
                          handleVerifyOtp(devOtpReceived);
                        }}
                      >
                        Auto-fill & Login
                      </button>
                    </div>
                  )}

                  <div className="otp-digit-inputs" onPaste={handleOtpPaste}>
                    {otpCode.map((digit, idx) => (
                      <input
                        key={idx}
                        ref={(el) => (otpInputRefs.current[idx] = el)}
                        type="text"
                        inputMode="numeric"
                        maxLength={1}
                        className="otp-box-input"
                        value={digit}
                        onChange={(e) => handleOtpChange(idx, e.target.value)}
                        onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                        autoFocus={idx === 0}
                      />
                    ))}
                  </div>

                  {authError && (
                    <p style={{ color: "#dc2626", fontSize: "13.5px", marginBottom: "14px", textAlign: "center" }}>
                      ⚠️ {authError}
                    </p>
                  )}

                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "20px" }}>
                    <button
                      type="button"
                      className="btn-signout"
                      onClick={() => handleSendOtp({ preventDefault: () => {} })}
                      disabled={authLoading}
                    >
                      Resend Code
                    </button>
                    <div style={{ display: "flex", gap: "10px" }}>
                      <button
                        type="button"
                        className="btn-secondary"
                        onClick={() => setShowAuthModal(false)}
                        disabled={authLoading}
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        className="btn-primary"
                        onClick={() => handleVerifyOtp()}
                        disabled={authLoading}
                      >
                        {authLoading ? "Verifying..." : "Verify & Sign In"}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Note Editor Modal */}
      {activeNoteProblem && (
        <div
          className="modal-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) setActiveNoteProblem(null);
          }}
        >
          <div className="modal-dialog">
            <div className="modal-header">
              <h3 className="modal-title">Notes: {activeNoteProblem.problem_name}</h3>
              <button className="modal-close-btn" onClick={() => setActiveNoteProblem(null)}>
                ✕
              </button>
            </div>
            <div className="modal-body">
              <textarea
                className="notes-textarea"
                placeholder="Write your notes, key intuition, time complexity, or tricky edge cases..."
                value={currentNoteText}
                onChange={(e) => setCurrentNoteText(e.target.value)}
                autoFocus
              />
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setActiveNoteProblem(null)}>
                Cancel
              </button>
              <button className="btn-primary" onClick={handleSaveNote}>
                Save Notes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reset Confirmation Modal */}
      {showResetModal && (
        <div
          className="modal-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowResetModal(false);
          }}
        >
          <div className="modal-dialog">
            <div className="modal-header">
              <h3 className="modal-title">Reset Sheet Progress</h3>
              <button className="modal-close-btn" onClick={() => setShowResetModal(false)}>
                ✕
              </button>
            </div>
            <div className="modal-body">
              <p style={{ color: "#475569", fontSize: "14.5px" }}>
                Are you sure you want to reset all your completed questions, revision stars, and notes? This will also clear your progress from the cloud database.
              </p>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setShowResetModal(false)}>
                Cancel
              </button>
              <button className="btn-danger" onClick={handleResetProgress}>
                Yes, Reset Everything
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toastMessage && (
        <div className="toast-notice">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
