"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import sheetData from "@/data/strivers_sde_sheet.json";

export default function SdeSheetPage() {
  // User Authentication & Cloud Sync (Email + 6-Digit PIN)
  const [currentUser, setCurrentUser] = useState(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authEmail, setAuthEmail] = useState("");
  const [authPin, setAuthPin] = useState("");
  const [showPin, setShowPin] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState("");
  const [showUserMenu, setShowUserMenu] = useState(false);

  // Dark Theme state ('dark' | 'light')
  const [theme, setTheme] = useState("dark");

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
  const syncTimeoutRef = useRef(null);
  const lastSyncedHashRef = useRef("");

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
    const currentHash = JSON.stringify({
      done: Array.from(currentDone).sort(),
      starred: Array.from(currentStarred).sort(),
      notes: currentNotes,
    });
    if (currentHash === lastSyncedHashRef.current) return;

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
        lastSyncedHashRef.current = currentHash;
      }
    } catch (e) {
      console.error("Cloud sync error:", e);
    } finally {
      setIsSyncing(false);
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

            // Record sync hash
            lastSyncedHashRef.current = JSON.stringify({
              done: Array.from(mergedDone).sort(),
              starred: Array.from(mergedStarred).sort(),
              notes: mergedNotes,
            });

            // Silent sync if local had extra entries
            if (localDone.size > 0 || localStarred.size > 0 || Object.keys(localNotes).length > 0) {
              fetch("/api/progress", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  done: Array.from(mergedDone),
                  starred: Array.from(mergedStarred),
                  notes: mergedNotes,
                }),
              }).catch(() => {});
            }
          }
        }
      })
      .catch((err) => console.error("Session check failed:", err))
    // Initialize Dark Theme
    try {
      const savedTheme = localStorage.getItem("tuf_theme") || "dark";
      setTheme(savedTheme);
      document.documentElement.setAttribute("data-theme", savedTheme);
    } catch (e) {}

    setIsLoaded(true);
  }, [syncToCloud]);

  // Toggle Dark/Light Theme
  const toggleTheme = () => {
    const nextTheme = theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
    try {
      localStorage.setItem("tuf_theme", nextTheme);
    } catch (e) {}
    document.documentElement.setAttribute("data-theme", nextTheme);
    showToast(`Switched to ${nextTheme === "dark" ? "Dark" : "Light"} mode`);
  };

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
    const currentHash = JSON.stringify({
      done: Array.from(doneIds).sort(),
      starred: Array.from(starredIds).sort(),
      notes: notes,
    });
    if (currentHash === lastSyncedHashRef.current) return;

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

  // Sign In / Create Account with Email + 6-Digit PIN
  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    if (!authEmail.trim()) {
      setAuthError("Please enter your email address.");
      return;
    }
    const cleanPin = authPin.trim();
    if (!/^\d{6}$/.test(cleanPin)) {
      setAuthError("Please enter a valid 6-digit numeric PIN.");
      return;
    }

    setAuthLoading(true);
    setAuthError("");
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: authEmail.trim(),
          pin: cleanPin,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setAuthError(data.error || "Failed to log in.");
      } else {
        setCurrentUser(data.user);
        setShowAuthModal(false);
        setAuthPin("");

        // Merge cloud data with existing local progress
        if (data.progress) {
          const mergedDone = new Set([...(data.progress.done || []), ...Array.from(doneIds)]);
          const mergedStarred = new Set([...(data.progress.starred || []), ...Array.from(starredIds)]);
          const mergedNotes = { ...(data.progress.notes || {}), ...notes };

          setDoneIds(mergedDone);
          setStarredIds(mergedStarred);
          setNotes(mergedNotes);

          lastSyncedHashRef.current = JSON.stringify({
            done: Array.from(mergedDone).sort(),
            starred: Array.from(mergedStarred).sort(),
            notes: mergedNotes,
          });

          // Sync if local had items
          if (doneIds.size > 0 || starredIds.size > 0) {
            syncToCloud(mergedDone, mergedStarred, mergedNotes);
          }
        }

        showToast(data.isNew ? "Account created & synced! 🚀" : `Welcome back, ${data.user.email}! 🚀`);
      }
    } catch (err) {
      setAuthError("Network error. Please try again.");
    } finally {
      setAuthLoading(false);
    }
  };

  // Sign out handler
  const handleSignOut = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      setCurrentUser(null);
      setShowUserMenu(false);
      lastSyncedHashRef.current = "";
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
          <div className="app-logo-badge" title="Striver's SDE Sheet">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="16 18 22 12 16 6" />
              <polyline points="8 6 2 12 8 18" />
              <line x1="14" y1="4" x2="10" y2="20" stroke="var(--accent-orange)" strokeWidth="2.6" />
            </svg>
          </div>
        </div>

        <nav className="nav-links">
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
          {/* User Account / Cloud Sync in Sidebar */}
          {currentUser ? (
            <div className="sidebar-profile-wrap">
              <button
                className="sidebar-profile-btn"
                title={`${currentUser.email} (Cloud Synced)`}
                onClick={() => setShowUserMenu(!showUserMenu)}
              >
                <div className="sidebar-avatar-circle">
                  {currentUser.email[0]}
                </div>
                <span className={`sidebar-sync-dot ${isSyncing ? "syncing" : ""}`} />
              </button>

              {showUserMenu && (
                <div className="sidebar-user-popover">
                  <div className="sidebar-user-email-text" title={currentUser.email}>
                    {currentUser.email}
                  </div>
                  <div className="sidebar-user-status-pill">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z" />
                    </svg>
                    <span>{isSyncing ? "Syncing..." : "Cloud Synced"}</span>
                  </div>
                  <button className="sidebar-signout-action" onClick={() => { setShowUserMenu(false); handleSignOut(); }}>
                    Sign Out
                  </button>
                </div>
              )}
            </div>
          ) : (
            <button
              className="icon-btn-ghost"
              title="Sign In & Sync Progress"
              onClick={() => { setShowAuthModal(true); setAuthError(""); }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            </button>
          )}

          {/* Theme Toggle Button */}
          <button
            className="icon-btn-ghost"
            title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            onClick={toggleTheme}
          >
            {theme === "dark" ? (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="5" />
                <line x1="12" y1="1" x2="12" y2="3" />
                <line x1="12" y1="21" x2="12" y2="23" />
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                <line x1="1" y1="12" x2="3" y2="12" />
                <line x1="21" y1="12" x2="23" y2="12" />
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
              </svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
              </svg>
            )}
          </button>

          {/* Export */}
          <button className="icon-btn-ghost" title="Export Progress (JSON)" onClick={handleExportData}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
          </button>

          {/* Import */}
          <button className="icon-btn-ghost" title="Import Progress" onClick={() => fileInputRef.current?.click()}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
          </button>
          <input type="file" ref={fileInputRef} onChange={handleImportData} accept=".json" style={{ display: "none" }} />

          {/* Reset */}
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

      {/* Popover backdrop */}
      {showUserMenu && (
        <div className="popover-backdrop" onClick={() => setShowUserMenu(false)} />
      )}

      {/* Main Content Area */}
      <main className="main-wrapper">
        {/* Header Section - Clean & Minimal */}
        <header className="page-header">
          <div className="header-top-row">
            <h1 className="page-title">{sheetData.title}</h1>
          </div>

          <p className="page-description">
            {sheetData.description}.
            <span className="description-link" onClick={() => setShowKnowMore(!showKnowMore)}>
              {showKnowMore ? "Show less" : "Know more"}
            </span>
          </p>

          {showKnowMore && (
            <div style={{ marginTop: "12px", padding: "14px 18px", background: "var(--bg-card)", borderRadius: "10px", border: "1px solid var(--border-color)", fontSize: "13.5px", color: "var(--text-secondary)" }}>
              <strong style={{ color: "var(--text-primary)" }}>💡 Tips for cracking top tech interviews:</strong>
              <ul style={{ paddingLeft: "20px", marginTop: "6px", display: "flex", flexDirection: "column", gap: "4px" }}>
                <li>Do not jump straight to the code. Spend 10-15 minutes understanding edge cases, brute force, and optimal logic.</li>
                <li>Mark problems for <strong>Revision ⭐</strong> that took you more than 30 minutes to solve or where the pattern was tricky.</li>
                <li><strong>Cloud Sync ☁️:</strong> Sign in with your email and 6-digit PIN to synchronize your progress across all your devices securely on Vercel Postgres / Neon!</li>
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

      {/* Authentication Modal (Email + 6-Digit PIN) */}
      {showAuthModal && (
        <div
          className="modal-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget && !authLoading) setShowAuthModal(false);
          }}
        >
          <div className="modal-dialog">
            <div className="modal-header">
              <h3 className="modal-title">Save & Sync Your Progress</h3>
              <button className="modal-close-btn" onClick={() => !authLoading && setShowAuthModal(false)}>
                ✕
              </button>
            </div>

            <div className="modal-body">
              <form onSubmit={handleAuthSubmit}>
                <div className="auth-input-group">
                  <label className="auth-label">Email Address</label>
                  <input
                    type="email"
                    className="auth-input"
                    placeholder="name@example.com"
                    value={authEmail}
                    onChange={(e) => setAuthEmail(e.target.value)}
                    required
                    autoFocus
                  />
                  <p className="auth-hint-text">
                    Identifies your account in the cloud to sync across devices.
                  </p>
                </div>

                <div className="auth-input-group">
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                    <label className="auth-label" style={{ margin: 0 }}>6-Digit Security PIN</label>
                    <button
                      type="button"
                      style={{ fontSize: "12px", color: "var(--accent-orange)", fontWeight: 600, cursor: "pointer" }}
                      onClick={() => setShowPin(!showPin)}
                    >
                      {showPin ? "Hide PIN" : "Show PIN"}
                    </button>
                  </div>
                  <input
                    type={showPin ? "text" : "password"}
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={6}
                    className="auth-input auth-pin-input"
                    placeholder="Enter 6-digit PIN"
                    value={authPin}
                    onChange={(e) => setAuthPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    required
                  />
                  <p className="auth-hint-text">
                    Enter any 6-digit numeric PIN to protect and access your progress.
                  </p>
                </div>

                {authError && (
                  <p style={{ color: "#ef4444", fontSize: "13.5px", marginBottom: "14px", fontWeight: 500 }}>
                    ⚠️ {authError}
                  </p>
                )}

                <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "20px" }}>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => setShowAuthModal(false)}
                    disabled={authLoading}
                  >
                    Cancel
                  </button>
                  <button type="submit" className="btn-primary" disabled={authLoading}>
                    {authLoading ? "Signing In..." : "Sign In & Sync"}
                  </button>
                </div>
              </form>
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
