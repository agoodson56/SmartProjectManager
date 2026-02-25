import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { Material } from './types';
import { motion, AnimatePresence } from 'motion/react';
import * as XLSX from 'xlsx';
import {
  LayoutDashboard,
  PlusCircle,
  User as UserIcon,
  Clock,
  Package,
  TrendingDown,
  TrendingUp,
  Minus,
  Trash2,
  Boxes,
  ChevronRight,
  Settings2,
  Monitor,
  CheckCircle2,
  Calendar,
  Download,
  Upload,
  FileSpreadsheet,
  LogOut,
  Lock,
  KeyRound
} from 'lucide-react';
import { cn } from './lib/utils';
import { Project, MANAGERS, Manager, User } from './types';

export default function App() {
  // Auth state
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authToken, setAuthToken] = useState<string | null>(() => localStorage.getItem('spm_token'));
  const [authScreen, setAuthScreen] = useState<'login' | 'change-password' | 'app'>('login');
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);

  // App state
  const [projects, setProjects] = useState<Project[]>([]);
  const [view, setView] = useState<'dashboard' | 'input'>('dashboard');
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [editMode, setEditMode] = useState<'progress' | 'details' | 'materials'>('progress');
  const [isUpdating, setIsUpdating] = useState(false);

  // Material state
  const [materials, setMaterials] = useState<Material[]>([]);
  const [matName, setMatName] = useState('');
  const [matQty, setMatQty] = useState('');
  const [matLaborPerUnit, setMatLaborPerUnit] = useState('');
  const [matCost, setMatCost] = useState('');
  const [loadingMaterials, setLoadingMaterials] = useState(false);
  const [csvPreview, setCsvPreview] = useState<{ name: string; quantity: number; labor_hours_per_unit: number }[]>([]);
  const [csvUploading, setCsvUploading] = useState(false);
  const [logMaterialId, setLogMaterialId] = useState<number | null>(null);
  const [logQty, setLogQty] = useState('');
  const [logHours, setLogHours] = useState('');
  const [logCost, setLogCost] = useState('');
  const [editingCostId, setEditingCostId] = useState<number | null>(null);

  // Proposal upload state
  const [proposalMaterials, setProposalMaterials] = useState<{ name: string; quantity: number; labor_hours_per_unit: number; unit_cost: number; selected: boolean }[]>([]);
  const [proposalLoading, setProposalLoading] = useState(false);
  const [proposalError, setProposalError] = useState('');
  const [proposalAsAddon, setProposalAsAddon] = useState(false);

  // Dashboard auto-cycle — dynamic scaling & projects per page
  const [projectsPerPage, setProjectsPerPage] = useState(6);
  const [dashboardPage, setDashboardPage] = useState(0);
  const [cycleProgress, setCycleProgress] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [dashScale, setDashScale] = useState(1);

  // Auto-detect screen size: scale dashboard & calculate rows per page
  useEffect(() => {
    const calcLayout = () => {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      // Scale: 1x at 1920px, scales up for larger screens, min 0.85x for laptops
      const scale = Math.max(0.85, Math.min(vw / 1920, 2.5));
      setDashScale(scale);
      // Effective viewport height after zoom — content is rendered at scale,
      // so available logical pixels = actual pixels / scale
      const effectiveVh = vh / scale;
      const availableHeight = effectiveVh - 450; // header, cards, grid header, padding
      const rowHeight = 100;
      setProjectsPerPage(Math.max(1, Math.floor(availableHeight / rowHeight)));
    };
    calcLayout();
    window.addEventListener('resize', calcLayout);
    return () => window.removeEventListener('resize', calcLayout);
  }, []);

  // Form states
  const [name, setName] = useState('');
  const [manager, setManager] = useState<Manager>('Cos');
  const [leadName, setLeadName] = useState('');
  const [estLabor, setEstLabor] = useState('');
  const [estOdc, setEstOdc] = useState('');
  const [usedLabor, setUsedLabor] = useState('');
  const [usedOdc, setUsedOdc] = useState('');
  const [addLabor, setAddLabor] = useState('');
  const [addOdc, setAddOdc] = useState('');
  const [deadline, setDeadline] = useState('');

  // Auth headers helper
  const authHeaders = useCallback(() => ({
    'Content-Type': 'application/json',
    ...(authToken ? { 'Authorization': `Bearer ${authToken}` } : {}),
  }), [authToken]);

  // Fetch projects with auth
  const fetchProjects = useCallback(async (token: string) => {
    try {
      const res = await fetch('/api/projects', {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setProjects(data);
      }
    } catch (err) {
      console.error('Failed to fetch projects', err);
    }
  }, []);

  // Fetch materials for a project
  const fetchMaterials = useCallback(async (projectId: number, token: string) => {
    setLoadingMaterials(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/materials`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setMaterials(data);
      }
    } catch (err) {
      console.error('Failed to fetch materials', err);
    } finally {
      setLoadingMaterials(false);
    }
  }, []);

  // Check existing session on load
  useEffect(() => {
    const checkSession = async () => {
      const token = localStorage.getItem('spm_token');
      if (!token) {
        setCheckingSession(false);
        return;
      }
      try {
        const res = await fetch('/api/me', {
          headers: { 'Authorization': `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setCurrentUser(data.user);
          setAuthToken(token);
          if (data.user.must_change_password) {
            setAuthScreen('change-password');
          } else {
            setAuthScreen('app');
            fetchProjects(token);
          }
        } else {
          localStorage.removeItem('spm_token');
          setAuthToken(null);
        }
      } catch {
        localStorage.removeItem('spm_token');
        setAuthToken(null);
      }
      setCheckingSession(false);
    };
    checkSession();
  }, [fetchProjects]);

  // Refresh projects periodically (replaces Socket.IO for Cloudflare)
  useEffect(() => {
    if (authScreen !== 'app' || !authToken) return;
    const interval = setInterval(() => fetchProjects(authToken), 30000);
    return () => clearInterval(interval);
  }, [authScreen, authToken, fetchProjects]);

  // Auto-cycle dashboard pages every 30 seconds
  useEffect(() => {
    if (view !== 'dashboard' || isPaused) {
      setCycleProgress(0);
      return;
    }
    const totalPages = Math.ceil(projects.length / projectsPerPage);
    if (totalPages <= 1) return;

    const interval = setInterval(() => {
      setCycleProgress(prev => {
        if (prev >= 100) {
          setDashboardPage(p => { const tp = Math.ceil(projects.length / projectsPerPage); return (p + 1) % tp; });
          return 0;
        }
        return prev + (100 / 300); // 300 ticks over 30s (100ms interval)
      });
    }, 100);

    return () => clearInterval(interval);
  }, [view, isPaused, projects.length, projectsPerPage]);

  // Reset page when projects change
  useEffect(() => {
    setDashboardPage(0);
    setCycleProgress(0);
  }, [projects.length]);

  // Handle login
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setAuthLoading(true);
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: loginUsername, password: loginPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        setAuthError(data.error || 'Login failed');
        return;
      }
      setAuthToken(data.token);
      setCurrentUser(data.user);
      localStorage.setItem('spm_token', data.token);
      if (data.user.must_change_password) {
        setAuthScreen('change-password');
      } else {
        setAuthScreen('app');
        fetchProjects(data.token);
      }
    } catch {
      setAuthError('Network error. Please try again.');
    } finally {
      setAuthLoading(false);
      setLoginPassword('');
    }
  };

  // Handle change password
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    if (newPassword !== confirmPassword) {
      setAuthError('Passwords do not match');
      return;
    }
    if (newPassword.length < 4) {
      setAuthError('Password must be at least 4 characters');
      return;
    }
    setAuthLoading(true);
    try {
      const res = await fetch('/api/change-password', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ newPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        setAuthError(data.error || 'Failed to change password');
        return;
      }
      setCurrentUser(data.user);
      setAuthScreen('app');
      setNewPassword('');
      setConfirmPassword('');
      fetchProjects(authToken!);
    } catch {
      setAuthError('Network error. Please try again.');
    } finally {
      setAuthLoading(false);
    }
  };

  // Handle logout
  const handleLogout = async () => {
    try {
      await fetch('/api/logout', {
        method: 'POST',
        headers: authHeaders(),
      });
    } catch { }
    localStorage.removeItem('spm_token');
    setAuthToken(null);
    setCurrentUser(null);
    setProjects([]);
    setSelectedProject(null);
    setAuthScreen('login');
    setLoginUsername('');
    setLoginPassword('');
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsUpdating(true);
    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          name,
          manager,
          lead_name: leadName,
          est_labor_hours: parseFloat(estLabor) || 0,
          est_material_cost: 0,
          est_odc: parseFloat(estOdc) || 0,
          deadline: deadline || null,
        }),
      });
      if (res.ok) {
        setIsCreating(false);
        fetchProjects(authToken!);
        setName('');
        setManager('Cos');
        setLeadName('');
        setEstLabor('');
        setEstOdc('');
        setDeadline('');
      } else {
        let errorMessage = 'Failed to create project';
        try {
          const contentType = res.headers.get("content-type");
          if (contentType && contentType.includes("application/json")) {
            const errorData = await res.json();
            errorMessage = errorData.error || errorMessage;
          } else {
            errorMessage = `Server error: ${res.status} ${res.statusText}`;
          }
        } catch (e) {
          errorMessage = `Error parsing server response: ${res.status}`;
        }
        alert(`Error: ${errorMessage}`);
      }
    } catch (err) {
      console.error('Failed to create project', err);
      alert('Network error: Failed to connect to server');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProject) return;

    setIsUpdating(true);
    try {
      let payload;
      if (editMode === 'progress') {
        const currentLabor = selectedProject.used_labor_hours;

        const laborToAdd = parseFloat(addLabor) || 0;
        const odcToAdd = parseFloat(addOdc) || 0;

        // If they used the "New Total" fields, use those. Otherwise, add the incremental values.
        const finalLabor = usedLabor !== currentLabor.toString() ? (parseFloat(usedLabor) || 0) : currentLabor + laborToAdd;
        const currentOdc = selectedProject.used_odc;
        const finalOdc = usedOdc !== currentOdc.toString() ? (parseFloat(usedOdc) || 0) : currentOdc + odcToAdd;

        payload = {
          used_labor_hours: finalLabor,
          used_odc: finalOdc,
        };
      } else {
        payload = {
          name,
          manager,
          lead_name: leadName,
          est_labor_hours: parseFloat(estLabor) || 0,
          est_odc: parseFloat(estOdc) || 0,
          deadline: deadline || null,
        };
      }

      const res = await fetch(`/api/projects/${selectedProject.id}`, {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        setSelectedProject(null);
        fetchProjects(authToken!);
        setUsedLabor('');
        setUsedOdc('');
        setAddLabor('');
        setAddOdc('');
        setName('');
        setLeadName('');
        setEstLabor('');
        setDeadline('');
      } else {
        let errorMessage = 'Failed to update project';
        try {
          const contentType = res.headers.get("content-type");
          if (contentType && contentType.includes("application/json")) {
            const errorData = await res.json();
            errorMessage = errorData.error || errorMessage;
          } else {
            errorMessage = `Server error: ${res.status} ${res.statusText}`;
          }
        } catch (e) {
          errorMessage = `Error parsing server response: ${res.status}`;
        }
        alert(`Error: ${errorMessage}`);
      }
    } catch (err) {
      console.error('Failed to update project', err);
      alert('Network error: Failed to connect to server');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this project?')) return;
    try {
      await fetch(`/api/projects/${id}`, { method: 'DELETE', headers: authHeaders() });
      setSelectedProject(null);
      fetchProjects(authToken!);
    } catch (err) {
      console.error('Failed to delete project', err);
    }
  };

  // --- Material CRUD ---
  const handleAddMaterial = async (isAddon = false) => {
    if (!selectedProject || !matName || !matQty) return;
    try {
      const res = await fetch(`/api/projects/${selectedProject.id}/materials`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          name: matName,
          quantity: parseFloat(matQty) || 0,
          labor_hours_per_unit: parseFloat(matLaborPerUnit) || 0,
          unit_cost: parseFloat(matCost) || 0,
          is_addon: isAddon,
        }),
      });
      if (res.ok) {
        setMatName('');
        setMatQty('');
        setMatLaborPerUnit('');
        setMatCost('');
        fetchMaterials(selectedProject.id, authToken!);
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to add material');
      }
    } catch (err) {
      console.error('Failed to add material', err);
    }
  };

  const handleLogInstall = async (materialId: number) => {
    if (!selectedProject) return;
    const addQty = parseFloat(logQty) || 0;
    const addHours = parseFloat(logHours) || 0;
    const costVal = parseFloat(logCost);
    const hasCostChange = !isNaN(costVal);
    if (addQty <= 0 && addHours <= 0 && !hasCostChange) return;
    try {
      const body: any = { add_qty: addQty, add_hours: addHours };
      if (hasCostChange) {
        body.unit_cost = costVal;
      }
      const res = await fetch(`/api/projects/${selectedProject.id}/materials/${materialId}`, {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify(body),
      });
      if (res.ok) {
        setLogMaterialId(null);
        setLogQty('');
        setLogHours('');
        setLogCost('');
        fetchMaterials(selectedProject.id, authToken!);
        fetchProjects(authToken!);
      }
    } catch (err) {
      console.error('Failed to log install', err);
    }
  };

  const handleDeleteMaterial = async (materialId: number) => {
    if (!selectedProject || !confirm('Remove this material?')) return;
    try {
      await fetch(`/api/projects/${selectedProject.id}/materials/${materialId}`, {
        method: 'DELETE',
        headers: authHeaders(),
      });
      fetchMaterials(selectedProject.id, authToken!);
    } catch (err) {
      console.error('Failed to delete material', err);
    }
  };

  // --- Edit material cost inline ---
  const handleUpdateMaterialCost = async (materialId: number, newCost: number) => {
    if (!selectedProject) return;
    try {
      await fetch(`/api/projects/${selectedProject.id}/materials/${materialId}`, {
        method: 'PATCH',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ unit_cost: newCost }),
      });
      fetchMaterials(selectedProject.id, authToken!);
    } catch (err) {
      console.error('Failed to update material cost', err);
    }
    setEditingCostId(null);
  };

  // --- Proposal Upload & AI Extraction ---
  const handleProposalUpload = async (file: File) => {
    setProposalLoading(true);
    setProposalError('');
    setProposalMaterials([]);
    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) throw new Error('Gemini API key not configured. Add GEMINI_API_KEY to your .env file.');

      const ext = file.name.split('.').pop()?.toLowerCase() || '';

      // MIME types for Gemini inline_data
      const mimeMap: Record<string, string> = {
        pdf: 'application/pdf',
        docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        doc: 'application/msword',
        pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        ppt: 'application/vnd.ms-powerpoint',
        jpg: 'image/jpeg', jpeg: 'image/jpeg',
        png: 'image/png', gif: 'image/gif',
        webp: 'image/webp', bmp: 'image/bmp',
        tiff: 'image/tiff', tif: 'image/tiff',
        heic: 'image/heic',
      };

      // Determine how to read the file and build Gemini request parts
      const textExts = new Set(['csv', 'json', 'txt', 'xml', 'html', 'htm', 'md', 'rtf', 'log', 'yaml', 'yml', 'toml', 'ini', 'cfg', 'conf', 'tsv', 'tab']);
      const xlsExts = new Set(['xlsx', 'xls', 'xlsb', 'xlsm', 'ods']);

      let documentContent = '';
      let inlineData: { mimeType: string; data: string } | null = null;

      if (xlsExts.has(ext)) {
        // Spreadsheets: convert to CSV text via XLSX library
        const arrayBuffer = await file.arrayBuffer();
        const workbook = XLSX.read(arrayBuffer, { type: 'array' });
        const sheets: string[] = [];
        for (const sheetName of workbook.SheetNames) {
          const csv = XLSX.utils.sheet_to_csv(workbook.Sheets[sheetName]);
          if (csv.trim()) sheets.push(`=== Sheet: ${sheetName} ===\n${csv}`);
        }
        documentContent = sheets.join('\n\n');
        if (!documentContent.trim()) throw new Error('Spreadsheet appears to be empty.');
      } else if (mimeMap[ext]) {
        // Binary files (PDF, DOCX, images): send as base64 inline_data to Gemini
        const arrayBuffer = await file.arrayBuffer();
        const bytes = new Uint8Array(arrayBuffer);
        let binary = '';
        for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
        const base64 = btoa(binary);
        inlineData = { mimeType: mimeMap[ext], data: base64 };
      } else if (textExts.has(ext) || file.type.startsWith('text/')) {
        // Text-based files: read as text
        documentContent = await file.text();
        if (!documentContent.trim()) throw new Error('File appears to be empty.');
      } else {
        // Unknown extension: try text first, fall back to binary
        try {
          const text = await file.text();
          // Check if it looks like valid text (not garbled binary)
          const nonPrintable = (text.slice(0, 1000).match(/[\x00-\x08\x0E-\x1F]/g) || []).length;
          if (nonPrintable > 10) throw new Error('binary');
          documentContent = text;
          if (!documentContent.trim()) throw new Error('File appears to be empty.');
        } catch {
          // Treat as binary — send as octet-stream
          const arrayBuffer = await file.arrayBuffer();
          const bytes = new Uint8Array(arrayBuffer);
          let binary = '';
          for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
          const base64 = btoa(binary);
          inlineData = { mimeType: file.type || 'application/octet-stream', data: base64 };
        }
      }

      const systemPrompt = `You are a senior low-voltage / telecom / construction project estimator. Your job is to analyze ANY document — proposals, BOMs, quotes, emails, scope of work, spreadsheet exports, images of handwritten notes, blueprints, floor plans, photos of material labels, or any other format — and extract every material, equipment item, or supply mentioned.

CRITICAL RULES:
1. Extract EVERY physical item that gets installed, pulled, mounted, terminated, or consumed on a job site.
2. Materials include but are not limited to: cables (Cat5e, Cat6, Cat6A, fiber, coax), connectors, jacks, patch panels, faceplates, j-hooks, cable tray, conduit, boxes, racks, cabinets, switches, access points, cameras, speakers, sensors, power supplies, UPS, labels, velcro, zip ties, fire stop, and any other physical items.
3. If quantities are not explicit, make your best estimate based on context (e.g., "cabling for 200 drops" = 200 drops).
4. If labor hours are not specified, use these LOW-VOLTAGE INDUSTRY STANDARDS:
   - Cable pulling (per 100ft run): 0.5h
   - Individual cable drops / runs: 0.75h each
   - RJ45/Keystone jack termination: 0.15h each
   - Patch panel (24-port): 1.5h each
   - Faceplate / wall plate: 0.2h each
   - J-hooks (per 25): 0.5h
   - Cable tray (per 10ft section): 0.75h
   - Conduit (per 10ft): 1.0h
   - Rack/cabinet assembly: 3h each
   - Switch / network equipment: 1.5h each
   - Access point mounting: 0.75h each
   - Camera mounting: 1.0h each
   - Speaker / paging device: 0.5h each
   - Fire stopping (per penetration): 0.25h
   - Testing & certification (per drop): 0.15h
   - Labeling (per cable): 0.05h
5. Group similar items together (don't list "Cat6 cable" 10 times — combine into one line with total qty).
6. If the document mentions dollar amounts / pricing, EXTRACT the unit cost per item. If pricing is given as a total (e.g. "$5,000 for 200 jacks"), calculate the per-unit cost ($25 each).
7. If no pricing is found, estimate using these INDUSTRY STANDARD material costs:
   - Cat6 Plenum Cable (1000ft box): $180
   - Cat6A Plenum Cable (1000ft box): $350
   - Cat6 RJ45 Keystone Jacks: $3.50 each
   - Cat6A RJ45 Keystone Jacks: $8 each
   - 24-Port Patch Panel: $45 each
   - Single-Gang Faceplate: $2 each
   - J-Hooks (box of 25): $30
   - Cable Tray (10ft section): $35
   - 1" EMT Conduit (10ft): $12
   - 2-Post Rack: $250
   - 4-Post Cabinet: $800
   - Fire Stop Putty Pad: $5 each
   - Velcro Roll (75ft): $15
   - Cable Labels (roll of 100): $20
   - Access Points: $300 each
   - IP Cameras: $250 each
   - Network Switch (24-port): $400 each
   - For other items, use your best professional estimate.
8. If the document is a project report, budget summary, photo, or scanned image — extract any material references you can find.
9. For images: look for material labels, part numbers, counts of visible items, floor plan symbols, or any visual clue about materials and quantities.

For each item, return:
- name: clear, descriptive material name
- quantity: number of units
- labor_hours_per_unit: hours to install ONE unit
- unit_cost: dollar cost per single unit (number only, no $ sign)

Return ONLY a valid JSON array. No markdown fences, no explanation.
Example: [{"name":"Cat6 Plenum Cable (1000ft box)","quantity":5,"labor_hours_per_unit":5,"unit_cost":180},{"name":"Cat6 RJ45 Keystone Jacks","quantity":200,"labor_hours_per_unit":0.15,"unit_cost":3.50}]

If you truly cannot find ANY materials in the document, return an empty array: []`;

      // Build Gemini request parts
      const parts: any[] = [{ text: systemPrompt }];

      if (inlineData) {
        // Multimodal: send the binary file + text instruction
        parts.push({ inline_data: inlineData });
        parts.push({ text: `\n\nAnalyze the above file (${file.name}) and extract all materials.` });
      } else {
        // Text-only: append the document content
        parts.push({ text: `\n\n===== DOCUMENT (${file.name}) =====\n${documentContent.slice(0, 50000)}` });
      }

      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts }],
            generationConfig: { temperature: 0.1, maxOutputTokens: 16384 },
          }),
        }
      );

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(`Gemini API error: ${(errData as any)?.error?.message || res.statusText}`);
      }

      const result = await res.json() as any;
      const aiText = result?.candidates?.[0]?.content?.parts?.[0]?.text || '';

      // Extract JSON array from response (handles markdown code blocks, extra text, etc.)
      const jsonMatch = aiText.match(/\[[\s\S]*\]/);
      if (!jsonMatch) throw new Error('AI could not find any materials in this document.');

      const aiMaterials = JSON.parse(jsonMatch[0]);
      if (!Array.isArray(aiMaterials) || aiMaterials.length === 0) {
        throw new Error('AI analyzed the document but found no extractable materials.');
      }

      const parsed = aiMaterials.map((item: any) => ({
        name: String(item.name || item.material || item.description || 'Unknown').trim(),
        quantity: Math.max(1, parseFloat(item.quantity || item.qty || 1) || 1),
        labor_hours_per_unit: Math.max(0, parseFloat(item.labor_hours_per_unit || item.labor_hours || item.hours || item.labor || 0) || 0),
        unit_cost: Math.max(0, parseFloat(item.unit_cost || item.cost || item.price || item.unit_price || 0) || 0),
        selected: true,
      })).filter((m: { name: string }) => m.name && m.name !== 'Unknown');

      if (parsed.length === 0) throw new Error('No valid materials could be extracted.');
      setProposalMaterials(parsed);
    } catch (err: any) {
      console.error('Proposal upload failed:', err);
      setProposalError(err.message || 'Failed to analyze proposal file.');
    } finally {
      setProposalLoading(false);
    }
  };

  const handleProposalImport = async () => {
    if (!selectedProject || !authToken) return;
    const toImport = proposalMaterials.filter(m => m.selected && m.name);
    if (toImport.length === 0) return;
    setProposalLoading(true);
    try {
      for (const mat of toImport) {
        await fetch(`/api/projects/${selectedProject.id}/materials`, {
          method: 'POST',
          headers: authHeaders(),
          body: JSON.stringify({
            name: mat.name,
            quantity: mat.quantity,
            labor_hours_per_unit: mat.labor_hours_per_unit,
            unit_cost: mat.unit_cost,
            is_addon: proposalAsAddon,
          }),
        });
      }
      setProposalMaterials([]);
      setProposalAsAddon(false);
      fetchMaterials(selectedProject.id, authToken);
      fetchProjects(authToken);
    } catch (err) {
      console.error('Proposal import failed', err);
      setProposalError('Some materials failed to import.');
    } finally {
      setProposalLoading(false);
    }
  };

  // Role-based pricing visibility — only managers and admins see cost data
  const showPricing = currentUser?.role === 'manager' || currentUser?.role === 'admin';

  // Material totals for the selected project — split into original vs add-on
  const originalMaterials = useMemo(() => materials.filter(m => !m.is_addon), [materials]);
  const addonMaterials = useMemo(() => materials.filter(m => m.is_addon), [materials]);

  const calcMaterialTotals = (mats: typeof materials) => {
    const totalQty = mats.reduce((s, m) => s + m.quantity, 0);
    const totalUsed = mats.reduce((s, m) => s + m.quantity_used, 0);
    const totalLaborEst = mats.reduce((s, m) => s + (m.quantity * m.labor_hours_per_unit), 0);
    const totalActualHours = mats.reduce((s, m) => s + (m.actual_labor_hours || 0), 0);
    return { totalQty, totalUsed, totalRemaining: totalQty - totalUsed, totalLaborEst, totalActualHours };
  };

  const materialTotals = useMemo(() => calcMaterialTotals(materials), [materials]);
  const origTotals = useMemo(() => calcMaterialTotals(originalMaterials), [originalMaterials]);
  const addonTotals = useMemo(() => calcMaterialTotals(addonMaterials), [addonMaterials]);

  // Material status for dashboard — green/yellow/red based on labor efficiency
  const getMaterialStatus = (mats: typeof materials) => {
    if (mats.length === 0) return 'none';
    const estHours = mats.reduce((s, m) => s + (m.quantity * m.labor_hours_per_unit), 0);
    const actualHours = mats.reduce((s, m) => s + (m.actual_labor_hours || 0), 0);
    if (estHours === 0) return 'green';
    const ratio = actualHours / estHours;
    if (ratio <= 0.9) return 'green';
    if (ratio <= 1.0) return 'yellow';
    return 'red';
  };

  const { stats, totals } = useMemo(() => {
    const computedStats = projects.map(p => {
      const laborProgress = p.est_labor_hours > 0 ? (p.used_labor_hours / p.est_labor_hours) : 0;
      const odcProgress = p.est_odc > 0 ? (p.used_odc / p.est_odc) : 0;

      // Completion is weighted average of labor and ODC progress
      const activeTracks = [laborProgress, odcProgress].filter((_, i) => {
        if (i === 0) return p.est_labor_hours > 0;
        return p.est_odc > 0;
      });
      const completion = activeTracks.length > 0
        ? Math.min(Math.round((activeTracks.reduce((a, b) => a + b, 0) / activeTracks.length) * 100), 100)
        : 0;

      const totalEst = p.est_labor_hours + p.est_odc;
      const totalUsed = p.used_labor_hours + p.used_odc;

      const ratio = totalEst > 0 ? totalUsed / totalEst : 0;
      let status: 'under' | 'on' | 'warning' | 'over' = 'under';

      if (ratio > 1) status = 'over';
      else if (ratio >= 0.98) status = 'warning';
      else if (ratio >= 0.90) status = 'on';
      else status = 'under';

      return { ...p, completion, status, totalEst, totalUsed };
    });

    const computedTotals = computedStats.reduce((acc, p) => ({
      estLabor: acc.estLabor + p.est_labor_hours,
      usedLabor: acc.usedLabor + p.used_labor_hours,
      estOdc: acc.estOdc + p.est_odc,
      usedOdc: acc.usedOdc + p.used_odc,
      totalEst: acc.totalEst + p.totalEst,
      totalUsed: acc.totalUsed + p.totalUsed,
    }), { estLabor: 0, usedLabor: 0, estOdc: 0, usedOdc: 0, totalEst: 0, totalUsed: 0 });

    return { stats: computedStats, totals: computedTotals };
  }, [projects]);

  const overallRatio = totals.totalEst > 0 ? totals.totalUsed / totals.totalEst : 0;
  let overallStatus: 'under' | 'on' | 'warning' | 'over' = 'under';
  if (overallRatio > 1) overallStatus = 'over';
  else if (overallRatio >= 0.98) overallStatus = 'warning';
  else if (overallRatio >= 0.90) overallStatus = 'on';
  else overallStatus = 'under';

  const overallCompletion = totals.totalEst > 0 ? Math.round((totals.totalUsed / totals.totalEst) * 100) : 0;

  const handleDownloadReport = () => {
    const wb = XLSX.utils.book_new();

    // Sheet 1: Projects summary
    const projRows = projects.map(p => ({
      'Project Name': p.name,
      'Manager': p.manager,
      'Lead': p.lead_name,
      'Est. Labor Hours': p.est_labor_hours,
      'Used Labor Hours': p.used_labor_hours,
      'Labor Remaining': p.est_labor_hours - p.used_labor_hours,
      'Est. Material Cost': p.est_material_cost,
      'Used Material Cost': p.used_material_cost,
      'Est. Other Direct Cost': p.est_odc,
      'Used Other Direct Cost': p.used_odc,
      'Material Count': (p.mat_count || 0),
      'Add-On Count': (p.addon_count || 0),
      'Mat Labor Est': (p.mat_labor_est || 0),
      'Mat Labor Actual': (p.mat_labor_actual || 0),
      'Deadline': p.deadline || '',
      'Completed': p.completed_at || '',
      'Updated': p.updated_at,
    }));
    const ws1 = XLSX.utils.json_to_sheet(projRows);
    ws1['!cols'] = [
      { wch: 30 }, { wch: 12 }, { wch: 15 },
      { wch: 14 }, { wch: 14 }, { wch: 14 },
      { wch: 16 }, { wch: 16 },
      { wch: 18 }, { wch: 18 },
      { wch: 12 }, { wch: 12 },
      { wch: 14 }, { wch: 14 },
      { wch: 12 }, { wch: 12 }, { wch: 20 },
    ];
    XLSX.utils.book_append_sheet(wb, ws1, 'Projects');

    // Sheet 2: Materials detail (if currently viewing a project)
    if (materials.length > 0 && selectedProject) {
      const matRows = materials.map(m => {
        const laborEst = m.quantity * m.labor_hours_per_unit;
        const remaining = m.quantity - m.quantity_used;
        return {
          'Project': selectedProject.name,
          'Material': m.name,
          'Type': m.is_addon ? 'Add-On' : 'Original',
          'Qty Needed': m.quantity,
          'Qty Installed': m.quantity_used,
          'Remaining': remaining,
          'Labor Hrs/Unit': m.labor_hours_per_unit,
          'Est. Total Labor': laborEst,
          'Actual Labor': m.actual_labor_hours || 0,
          'Labor Variance': laborEst - (m.actual_labor_hours || 0),
          'Status': remaining <= 0 ? 'Complete' : (m.actual_labor_hours || 0) > laborEst ? 'Over Budget' : 'In Progress',
        };
      });
      const ws2 = XLSX.utils.json_to_sheet(matRows);
      ws2['!cols'] = [
        { wch: 28 }, { wch: 30 }, { wch: 10 },
        { wch: 11 }, { wch: 12 }, { wch: 11 },
        { wch: 13 }, { wch: 14 }, { wch: 12 },
        { wch: 14 }, { wch: 12 },
      ];
      XLSX.utils.book_append_sheet(wb, ws2, 'Materials');
    }

    XLSX.writeFile(wb, `3D_Project_Report_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  // Loading screen while checking session
  if (checkingSession) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-2 border-dashboard-accent border-t-transparent rounded-full animate-spin" />
          <span className="text-xs uppercase tracking-widest opacity-50">Loading...</span>
        </div>
      </div>
    );
  }

  // Login Screen
  if (authScreen === 'login') {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-md"
        >
          <div className="text-center mb-8">
            <img
              src="/logo.png"
              alt="3D Smart Project Manager"
              className="h-20 w-auto mx-auto mb-6 drop-shadow-[0_2px_12px_rgba(212,175,55,0.4)]"
            />
            <h1 className="text-2xl font-bold tracking-tight mb-1">Welcome Back</h1>
            <p className="text-sm opacity-50">Sign in to your project dashboard</p>
          </div>

          <form onSubmit={handleLogin} className="bg-white/5 border border-dashboard-line rounded-2xl p-8 space-y-6 backdrop-blur-sm">
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest">Username</label>
              <select
                value={loginUsername}
                onChange={(e) => setLoginUsername(e.target.value)}
                className="w-full bg-black/40 border border-white/20 rounded-xl py-3 px-4 focus:border-dashboard-accent outline-none transition-colors"
                required
              >
                <option value="">Select your name...</option>
                <option value="Allan">Allan (Admin)</option>
                {MANAGERS.map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest">Password</label>
              <div className="relative">
                <input
                  type="password"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="w-full bg-black/40 border border-white/20 rounded-xl py-3 px-4 pr-10 focus:border-dashboard-accent outline-none transition-colors"
                  required
                />
                <Lock size={14} className="absolute right-4 top-1/2 -translate-y-1/2 opacity-30" />
              </div>
            </div>

            {authError && (
              <motion.div
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-2"
              >
                {authError}
              </motion.div>
            )}

            <button
              type="submit"
              disabled={authLoading}
              className="w-full bg-dashboard-accent text-black font-bold py-4 rounded-xl hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-2 text-sm uppercase tracking-wider"
            >
              {authLoading ? (
                <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <KeyRound size={16} />
                  Sign In
                </>
              )}
            </button>
          </form>

          <p className="text-center text-[9px] uppercase tracking-widest opacity-30 mt-6">
            3D Smart Project Manager • Secure Access
          </p>
        </motion.div>
      </div>
    );
  }

  // Change Password Screen
  if (authScreen === 'change-password') {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-md"
        >
          <div className="text-center mb-8">
            <div className="w-16 h-16 rounded-full bg-dashboard-accent/20 border-2 border-dashboard-accent/50 flex items-center justify-center mx-auto mb-4">
              <KeyRound size={28} className="text-dashboard-accent" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight mb-1">Set Your Password</h1>
            <p className="text-sm opacity-50">
              Welcome, <span className="text-dashboard-accent font-semibold">{currentUser?.username}</span>! Please create a unique password.
            </p>
          </div>

          <form onSubmit={handleChangePassword} className="bg-white/5 border border-dashboard-line rounded-2xl p-8 space-y-6 backdrop-blur-sm">
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest">New Password</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Choose a new password"
                className="w-full bg-black/40 border border-white/20 rounded-xl py-3 px-4 focus:border-dashboard-accent outline-none transition-colors"
                required
                minLength={4}
              />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest">Confirm Password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter your password"
                className="w-full bg-black/40 border border-white/20 rounded-xl py-3 px-4 focus:border-dashboard-accent outline-none transition-colors"
                required
                minLength={4}
              />
            </div>

            {authError && (
              <motion.div
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-2"
              >
                {authError}
              </motion.div>
            )}

            <button
              type="submit"
              disabled={authLoading}
              className="w-full bg-dashboard-accent text-black font-bold py-4 rounded-xl hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-2 text-sm uppercase tracking-wider"
            >
              {authLoading ? (
                <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin" />
              ) : (
                'Set Password & Continue'
              )}
            </button>
          </form>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b border-dashboard-line p-6 flex items-center justify-between bg-dashboard-bg/80 backdrop-blur-md sticky top-0 z-10">
        <img
          src="/logo.png"
          alt="3D Smart Project Manager"
          className="h-16 w-auto object-contain drop-shadow-[0_2px_8px_rgba(212,175,55,0.3)]"
        />

        <nav className="flex items-center gap-4">
          <button
            onClick={handleDownloadReport}
            className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-xs font-bold uppercase tracking-wider hover:bg-white/10 transition-all"
          >
            <Download size={14} />
            Download Report
          </button>
          <div className="flex gap-2">
            <button
              onClick={() => setView('dashboard')}
              className={cn(
                "px-4 py-2 rounded-md text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-2",
                view === 'dashboard' ? "bg-dashboard-accent text-black" : "hover:bg-white/5"
              )}
            >
              <Monitor size={14} />
              Dashboard
            </button>
            <button
              onClick={() => setView('input')}
              className={cn(
                "px-4 py-2 rounded-md text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-2",
                view === 'input' ? "bg-dashboard-accent text-black" : "hover:bg-white/5"
              )}
            >
              <Settings2 size={14} />
              PM Portal
            </button>
          </div>
          <div className="h-6 w-px bg-white/10" />
          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="text-xs font-bold">{currentUser?.username}</div>
              <div className="text-[9px] uppercase tracking-widest opacity-50">
                {currentUser?.role === 'admin' ? 'Administrator' : 'Project Manager'}
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="p-2 rounded-lg bg-white/5 border border-white/10 hover:bg-red-500/20 hover:border-red-500/30 hover:text-red-400 transition-all"
              title="Sign Out"
            >
              <LogOut size={14} />
            </button>
          </div>
        </nav>
      </header>

      <main className="flex-1 p-6">
        <AnimatePresence mode="wait">
          {view === 'dashboard' ? (
            <motion.div
              key="dashboard"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
              style={{ zoom: dashScale }}
            >
              {/* Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-7 gap-4">
                <div className="bg-white/5 border border-dashboard-line p-5 rounded-xl">
                  <div className="text-sm font-bold uppercase tracking-widest mb-2">Total Labor Hours</div>
                  <div className="text-3xl font-bold tracking-tighter">
                    {totals.usedLabor.toLocaleString()} <span className="text-lg opacity-50">/ {totals.estLabor.toLocaleString()}</span>
                  </div>
                  <div className={cn(
                    "text-base font-bold mt-2",
                    (totals.estLabor - totals.usedLabor) < 0 ? "text-red-400" : "text-emerald-400"
                  )}>
                    {(totals.estLabor - totals.usedLabor).toLocaleString()} remaining
                  </div>
                  <div className="w-full h-2 bg-white/10 rounded-full mt-3 overflow-hidden">
                    <div className="h-full bg-dashboard-accent" style={{ width: `${Math.min((totals.usedLabor / (totals.estLabor || 1)) * 100, 100)}%` }} />
                  </div>
                </div>

                <div className="bg-white/5 border border-dashboard-line p-5 rounded-xl">
                  <div className="text-sm font-bold uppercase tracking-widest mb-2">Total Other Direct Cost</div>
                  <div className="text-3xl font-bold tracking-tighter">
                    ${totals.usedOdc.toLocaleString()} <span className="text-lg opacity-50">/ ${totals.estOdc.toLocaleString()}</span>
                  </div>
                  <div className={cn(
                    "text-base font-bold mt-2",
                    (totals.estOdc - totals.usedOdc) < 0 ? "text-red-400" : "text-emerald-400"
                  )}>
                    ${(totals.estOdc - totals.usedOdc).toLocaleString()} remaining
                  </div>
                  <div className="w-full h-2 bg-white/10 rounded-full mt-3 overflow-hidden">
                    <div className="h-full bg-dashboard-accent" style={{ width: `${Math.min((totals.usedOdc / (totals.estOdc || 1)) * 100, 100)}%` }} />
                  </div>
                </div>
                <div className="bg-white/5 border border-dashboard-line p-5 rounded-xl">
                  <div className="text-sm font-bold uppercase tracking-widest mb-2">Portfolio Completion</div>
                  <div className="text-3xl font-bold tracking-tighter">{overallCompletion}%</div>
                  <div className="w-full h-2 bg-white/10 rounded-full mt-3 overflow-hidden">
                    <div className="h-full bg-dashboard-accent" style={{ width: `${overallCompletion}%` }} />
                  </div>
                </div>
                <div className={cn(
                  "border p-5 rounded-xl flex flex-col justify-center transition-colors duration-500",
                  overallStatus === 'under' && "border-purple-500/30 bg-purple-500/5 text-purple-400",
                  overallStatus === 'on' && "border-emerald-500/30 bg-emerald-500/5 text-emerald-400",
                  overallStatus === 'warning' && "border-yellow-500/30 bg-yellow-500/5 text-yellow-400",
                  overallStatus === 'over' && "border-red-500/30 bg-red-500/5 text-red-400"
                )}>
                  <div className="text-sm font-bold uppercase tracking-widest mb-2">Portfolio Budget Status</div>
                  <div className="text-3xl font-bold tracking-tighter uppercase flex items-center gap-3">
                    <div className={cn(
                      "w-5 h-5 rounded-full",
                      overallStatus === 'under' && "bg-purple-500 shadow-[0_0_14px_rgba(168,85,247,0.5)]",
                      overallStatus === 'on' && "bg-emerald-500 shadow-[0_0_14px_rgba(16,185,129,0.5)]",
                      overallStatus === 'warning' && "bg-yellow-500 shadow-[0_0_14px_rgba(234,179,8,0.5)] animate-pulse",
                      overallStatus === 'over' && "bg-red-500 shadow-[0_0_14px_rgba(239,68,68,0.5)] animate-pulse"
                    )} />
                    {overallStatus === 'warning' ? 'Jeopardy' : overallStatus}
                  </div>
                </div>
                {/* Manager Rankings Card */}
                <div className="bg-white/5 border border-dashboard-line p-5 rounded-xl md:col-span-2">
                  <div className="text-sm font-bold uppercase tracking-widest mb-3">Manager Rankings</div>
                  <div className="space-y-2">
                    {(() => {
                      const managerMap: Record<string, { totalEst: number; totalUsed: number; projectCount: number }> = {};
                      stats.forEach(p => {
                        if (!managerMap[p.manager]) {
                          managerMap[p.manager] = { totalEst: 0, totalUsed: 0, projectCount: 0 };
                        }
                        managerMap[p.manager].totalEst += p.totalEst;
                        managerMap[p.manager].totalUsed += p.totalUsed;
                        managerMap[p.manager].projectCount += 1;
                      });
                      const ranked = Object.entries(managerMap)
                        .map(([name, data]) => ({
                          name,
                          ratio: data.totalEst > 0 ? data.totalUsed / data.totalEst : 0,
                          projectCount: data.projectCount,
                          remaining: data.totalEst - data.totalUsed,
                        }))
                        .sort((a, b) => a.ratio - b.ratio);
                      return ranked.map((mgr, i) => (
                        <div key={mgr.name} className="flex items-center gap-3">
                          <div className={cn(
                            "w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0",
                            i === 0 && "bg-dashboard-accent text-black",
                            i === 1 && "bg-white/20 text-white",
                            i === 2 && "bg-amber-700/40 text-amber-400",
                            i > 2 && "bg-white/10 text-white/60"
                          )}>
                            {i + 1}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-bold truncate">{mgr.name}</div>
                            <div className="text-[10px] uppercase tracking-widest opacity-50">{mgr.projectCount} project{mgr.projectCount !== 1 ? 's' : ''}</div>
                          </div>
                          <div className={cn(
                            "text-sm font-bold",
                            mgr.ratio > 1 ? "text-red-400" : mgr.ratio >= 0.90 ? "text-yellow-400" : "text-emerald-400"
                          )}>
                            {Math.round(mgr.ratio * 100)}%
                          </div>
                        </div>
                      ));
                    })()}
                  </div>
                </div>
              </div>

              {/* Dashboard Grid */}
              <div className="grid grid-cols-1 gap-1 border border-dashboard-accent/40 rounded-lg overflow-hidden bg-dashboard-accent/30">
                {/* Header Row */}
                <div className="grid grid-cols-[2.5fr_0.5fr_1fr_1fr_1fr_1fr_1fr_1fr_0.8fr_0.5fr] gap-3 px-6 py-4 bg-dashboard-bg text-sm font-bold uppercase tracking-widest">
                  <div>Project</div>
                  <div className="text-center">Material</div>
                  <div className="text-center">Labor Est</div>
                  <div className="text-center">Labor Used</div>
                  <div className="text-center">Labor Rem</div>
                  <div className="text-center">Other Direct Cost Est</div>
                  <div className="text-center">Other Direct Cost Used</div>
                  <div className="text-center">Other Direct Cost Rem</div>
                  <div className="text-center">Complete</div>
                  <div className="text-center">Status</div>
                </div>

                {stats.slice(dashboardPage * projectsPerPage, (dashboardPage + 1) * projectsPerPage).map((project) => {
                  const laborRemaining = project.est_labor_hours - project.used_labor_hours;

                  return (
                    <motion.div
                      layout
                      key={project.id}
                      className="grid grid-cols-[2.5fr_0.5fr_1fr_1fr_1fr_1fr_1fr_1fr_0.8fr_0.5fr] gap-3 px-6 py-5 bg-dashboard-bg items-center group hover:bg-white/5 transition-colors"
                    >
                      {/* Project Info */}
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-lg font-bold tracking-tight">{project.name}</h3>
                          {project.completed_at && (
                            <span className="px-2 py-1 bg-emerald-500/20 text-emerald-400 text-xs font-bold uppercase tracking-widest rounded border border-emerald-500/30 flex items-center gap-1">
                              <CheckCircle2 size={14} /> Done
                            </span>
                          )}
                        </div>
                        <div className="flex flex-col gap-1 mt-2">
                          <div className="flex items-center gap-4">
                            <span className="text-sm flex items-center gap-1.5">
                              <UserIcon size={14} /> {project.manager}
                            </span>
                            {project.lead_name && (
                              <span className="text-sm font-medium text-amber-400">
                                Lead: {project.lead_name}
                              </span>
                            )}
                          </div>
                          {project.deadline && (
                            <span className={cn(
                              "text-xs font-bold uppercase tracking-widest inline-flex items-center gap-1.5 mt-1",
                              (() => {
                                const now = new Date();
                                const due = new Date(project.deadline);
                                const diff = due.getTime() - now.getTime();
                                const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
                                if (days < 0) return "text-red-400";
                                if (days <= 7) return "text-yellow-400";
                                return "text-white/50";
                              })()
                            )}>
                              <Calendar size={14} />
                              {(() => {
                                const now = new Date();
                                const due = new Date(project.deadline);
                                const diff = due.getTime() - now.getTime();
                                const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
                                if (days < 0) return `Overdue (${Math.abs(days)}d)`;
                                if (days === 0) return "Due Today";
                                return `${days}d left`;
                              })()}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Material Status Light */}
                      <div className="flex items-center justify-center">
                        {(() => {
                          const estH = project.mat_labor_est || 0;
                          const actH = project.mat_labor_actual || 0;
                          const count = (project.mat_count || 0) + (project.addon_count || 0);
                          if (count === 0) return (
                            <div className="flex flex-col items-center gap-1">
                              <div className="w-4 h-4 rounded-full border-2 bg-gray-500/40 border-gray-400/50" title="No materials" />
                              <span className="text-[8px] uppercase tracking-widest opacity-40">—</span>
                            </div>
                          );
                          const ratio = estH > 0 ? actH / estH : 0;
                          const statusColor = ratio <= 0.9 ? 'bg-emerald-500 border-emerald-400 shadow-emerald-500/50'
                            : ratio <= 1.0 ? 'bg-yellow-500 border-yellow-400 shadow-yellow-500/50'
                              : 'bg-red-500 border-red-400 shadow-red-500/50';
                          const label = ratio <= 0.9 ? 'Good' : ratio <= 1.0 ? 'Watch' : 'Over';
                          return (
                            <div className="flex flex-col items-center gap-1">
                              <div className={cn("w-4 h-4 rounded-full border-2 shadow-lg", statusColor)} title={`Material labor: ${actH.toFixed(1)}h / ${estH.toFixed(1)}h est (${Math.round(ratio * 100)}%)`} />
                              <span className="text-[8px] uppercase tracking-widest opacity-60">{label}</span>
                            </div>
                          );
                        })()}
                      </div>

                      {/* Labor Estimated */}
                      <div className="text-center">
                        <div className="text-lg font-bold tracking-tight">{project.est_labor_hours.toLocaleString()}</div>
                        <div className="text-xs uppercase tracking-widest opacity-50">hours</div>
                      </div>

                      {/* Labor Used */}
                      <div className="text-center">
                        <div className="text-lg font-bold tracking-tight text-amber-400">{project.used_labor_hours.toLocaleString()}</div>
                        <div className="text-xs uppercase tracking-widest opacity-50">hours</div>
                      </div>

                      {/* Labor Remaining */}
                      <div className="text-center">
                        <div className={cn(
                          "text-lg font-bold tracking-tight",
                          laborRemaining < 0 ? "text-red-400" : "text-emerald-400"
                        )}>
                          {laborRemaining < 0 ? '' : ''}{laborRemaining.toLocaleString()}
                        </div>
                        <div className="text-xs uppercase tracking-widest opacity-50">hours</div>
                      </div>



                      {/* Other Direct Cost Estimated */}
                      <div className="text-center">
                        <div className="text-lg font-bold tracking-tight">${project.est_odc.toLocaleString()}</div>
                        <div className="text-xs uppercase tracking-widest opacity-50">budget</div>
                      </div>

                      {/* Other Direct Cost Used */}
                      <div className="text-center">
                        <div className="text-lg font-bold tracking-tight text-amber-400">${project.used_odc.toLocaleString()}</div>
                        <div className="text-xs uppercase tracking-widest opacity-50">spent</div>
                      </div>

                      {/* Other Direct Cost Remaining */}
                      <div className="text-center">
                        <div className={cn(
                          "text-lg font-bold tracking-tight",
                          (project.est_odc - project.used_odc) < 0 ? "text-red-400" : "text-emerald-400"
                        )}>
                          ${(project.est_odc - project.used_odc).toLocaleString()}
                        </div>
                        <div className="text-xs uppercase tracking-widest opacity-50">remaining</div>
                      </div>

                      {/* % Complete */}
                      <div className="flex flex-col items-center gap-2">
                        <span className="text-2xl font-bold tracking-tighter">{project.completion}%</span>
                        <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${project.completion}%` }}
                            className="h-full bg-dashboard-accent"
                          />
                        </div>
                      </div>

                      {/* Status + Edit */}
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => {
                            setView('input');
                            setSelectedProject(project);
                            setUsedLabor(project.used_labor_hours.toString());
                            setUsedOdc(project.used_odc.toString());
                            setAddLabor('');
                            setAddOdc('');
                            setName(project.name);
                            setManager(project.manager as Manager);
                            setLeadName(project.lead_name || '');
                            setEstLabor(project.est_labor_hours.toString());
                            setEstOdc(project.est_odc.toString());
                            setDeadline(project.deadline ? project.deadline.split('T')[0] : '');
                            setEditMode('progress');
                            fetchMaterials(project.id, authToken!);
                          }}
                          className="p-2 rounded-lg bg-white/5 border border-white/10 hover:bg-dashboard-accent hover:text-black transition-all"
                        >
                          <PlusCircle size={18} />
                        </button>
                        <div className="relative">
                          <div className={cn(
                            "w-5 h-5 rounded-full border-2 border-black/50 shadow-lg transition-all duration-500",
                            project.status === 'under' && "bg-purple-500 shadow-purple-500/50",
                            project.status === 'on' && "bg-emerald-500 shadow-emerald-500/50",
                            project.status === 'warning' && "bg-yellow-500 shadow-yellow-500/50 animate-pulse",
                            project.status === 'over' && "bg-red-500 shadow-red-500/50 animate-pulse"
                          )} />
                          <div className={cn(
                            "absolute inset-0 rounded-full blur-[4px] opacity-50",
                            project.status === 'under' && "bg-purple-500",
                            project.status === 'on' && "bg-emerald-500",
                            project.status === 'warning' && "bg-yellow-500",
                            project.status === 'over' && "bg-red-500"
                          )} />
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>

              {/* Page Indicator & Auto-Cycle */}
              {Math.ceil(stats.length / projectsPerPage) > 1 && (
                <div
                  className="flex items-center justify-center gap-4 mt-4"
                  onMouseEnter={() => setIsPaused(true)}
                  onMouseLeave={() => setIsPaused(false)}
                >
                  <div className="flex items-center gap-2">
                    {Array.from({ length: Math.ceil(stats.length / projectsPerPage) }).map((_, i) => (
                      <button
                        key={i}
                        onClick={() => { setDashboardPage(i); setCycleProgress(0); }}
                        className={cn(
                          "w-2.5 h-2.5 rounded-full transition-all duration-300",
                          i === dashboardPage
                            ? "bg-dashboard-accent scale-125 shadow-[0_0_8px_rgba(212,175,55,0.5)]"
                            : "bg-white/20 hover:bg-white/40"
                        )}
                      />
                    ))}
                  </div>
                  <div className="w-32 h-1 bg-white/10 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-dashboard-accent/60 transition-all duration-100"
                      style={{ width: `${cycleProgress}%` }}
                    />
                  </div>
                  <span className="text-sm uppercase tracking-widest opacity-40">
                    Page {dashboardPage + 1} / {Math.ceil(stats.length / projectsPerPage)}
                  </span>
                </div>
              )}
            </motion.div>
          ) : (
            <motion.div
              key="input"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="max-w-2xl mx-auto"
            >
              <div className="bg-white/5 border border-dashboard-line rounded-2xl p-8">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-bold flex items-center gap-3">
                    <Settings2 className="text-dashboard-accent" />
                    Project Manager Portal
                  </h2>
                  {!selectedProject && !isCreating && (
                    <button
                      onClick={() => setIsCreating(true)}
                      className="flex items-center gap-2 px-4 py-2 bg-dashboard-accent text-black rounded-lg text-xs font-bold uppercase tracking-wider hover:scale-105 transition-transform"
                    >
                      <PlusCircle size={14} />
                      New Project
                    </button>
                  )}
                </div>

                {isCreating ? (
                  <form onSubmit={handleCreate} className="space-y-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-bold">Initialize New Project</h3>
                      <button
                        type="button"
                        onClick={() => setIsCreating(false)}
                        className="text-xs hover:underline"
                      >
                        Back to List
                      </button>
                    </div>

                    <div className="space-y-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold uppercase tracking-widest">Project Name</label>
                        <input
                          type="text"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          className="w-full bg-black/40 border border-white/20 rounded-xl py-3 px-4 focus:border-dashboard-accent outline-none transition-colors"
                          placeholder="e.g. Skyline Tower"
                          required
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="text-[10px] font-bold uppercase tracking-widest">Assigned Manager</label>
                        <select
                          value={manager}
                          onChange={(e) => setManager(e.target.value as Manager)}
                          className="w-full bg-black/40 border border-white/20 rounded-xl py-3 px-4 focus:border-dashboard-accent outline-none transition-colors appearance-none"
                        >
                          {MANAGERS.map(m => <option key={m} value={m}>{m}</option>)}
                        </select>
                      </div>

                      <div className="space-y-2">
                        <label className="text-[10px] font-bold uppercase tracking-widest">Lead Name</label>
                        <input
                          type="text"
                          value={leadName}
                          onChange={(e) => setLeadName(e.target.value)}
                          className="w-full bg-black/40 border border-white/20 rounded-xl py-3 px-4 focus:border-dashboard-accent outline-none transition-colors"
                          placeholder="e.g. John Doe"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold uppercase tracking-widest">Est. Labor Hours</label>
                          <input
                            type="number"
                            value={estLabor}
                            onChange={(e) => setEstLabor(e.target.value)}
                            className="w-full bg-black/40 border border-white/20 rounded-xl py-3 px-4 focus:border-dashboard-accent outline-none transition-colors"
                            placeholder="0"
                            required
                          />
                        </div>

                      </div>

                      <div className="space-y-2">
                        <label className="text-[10px] font-bold uppercase tracking-widest">Est. Other Direct Cost ($)</label>
                        <input
                          type="number"
                          value={estOdc}
                          onChange={(e) => setEstOdc(e.target.value)}
                          className="w-full bg-black/40 border border-white/20 rounded-xl py-3 px-4 focus:border-dashboard-accent outline-none transition-colors"
                          placeholder="0.00"
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="text-[10px] font-bold uppercase tracking-widest">Project Deadline</label>
                        <div className="relative">
                          <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-dashboard-accent" />
                          <input
                            type="date"
                            value={deadline}
                            onChange={(e) => setDeadline(e.target.value)}
                            className="w-full bg-black/40 border border-white/20 rounded-xl py-3 pl-12 pr-4 focus:border-dashboard-accent outline-none transition-colors appearance-none"
                          />
                        </div>
                      </div>
                    </div>

                    <button
                      disabled={isUpdating}
                      className="w-full bg-dashboard-accent text-black font-bold py-4 rounded-xl hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50"
                    >
                      {isUpdating ? 'Creating...' : 'Create Project'}
                    </button>
                  </form>
                ) : !selectedProject ? (
                  <div className="space-y-4">
                    <p className="text-sm mb-4">Select a project to manage:</p>
                    {projects.map(p => (
                      <button
                        key={p.id}
                        onClick={() => {
                          setSelectedProject(p);
                          setUsedLabor(p.used_labor_hours.toString());
                          setUsedOdc(p.used_odc.toString());
                          setName(p.name);
                          setManager(p.manager as Manager);
                          setLeadName(p.lead_name || '');
                          setEstLabor(p.est_labor_hours.toString());
                          setEstOdc(p.est_odc.toString());
                          setDeadline(p.deadline ? p.deadline.split('T')[0] : '');
                          setEditMode('progress');
                          fetchMaterials(p.id, authToken!);
                        }}
                        className="w-full flex items-center justify-between p-4 rounded-xl border border-white/20 hover:border-dashboard-accent hover:bg-white/5 transition-all group"
                      >
                        <div className="text-left">
                          <div className="font-bold">{p.name}</div>
                          <div className="text-xs uppercase tracking-widest">{p.manager}</div>
                        </div>
                        <ChevronRight className="transition-opacity text-dashboard-accent" />
                      </button>
                    ))}
                  </div>
                ) : (
                  <form onSubmit={handleUpdate} className="space-y-6">
                    <div className="flex items-center justify-between mb-4 pb-4 border-b border-white/20">
                      <div>
                        <h3 className="text-xl font-bold">{selectedProject.name}</h3>
                        <p className="text-xs uppercase tracking-widest">Managing as {selectedProject.manager}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSelectedProject(null)}
                        className="text-xs hover:underline"
                      >
                        Back to List
                      </button>
                    </div>

                    {/* Mode Toggle */}
                    <div className="flex p-1 bg-black/40 rounded-lg border border-white/20 mb-6">
                      <button
                        type="button"
                        onClick={() => setEditMode('progress')}
                        className={cn(
                          "flex-1 py-2 text-[10px] font-bold uppercase tracking-widest rounded-md transition-all",
                          editMode === 'progress' ? "bg-white/20 text-white" : "text-white/60 hover:text-white"
                        )}
                      >
                        Update Progress
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditMode('materials')}
                        className={cn(
                          "flex-1 py-2 text-[10px] font-bold uppercase tracking-widest rounded-md transition-all flex items-center justify-center gap-1.5",
                          editMode === 'materials' ? "bg-white/20 text-white" : "text-white/60 hover:text-white"
                        )}
                      >
                        <Boxes size={12} />
                        Materials
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditMode('details')}
                        className={cn(
                          "flex-1 py-2 text-[10px] font-bold uppercase tracking-widest rounded-md transition-all",
                          editMode === 'details' ? "bg-white/20 text-white" : "text-white/60 hover:text-white"
                        )}
                      >
                        Edit Estimates
                      </button>
                    </div>

                    {editMode === 'progress' ? (
                      <div className="space-y-6">
                        <div className="grid grid-cols-2 gap-6">
                          <div className="space-y-4">
                            <div className="space-y-2">
                              <label className="text-[10px] font-bold uppercase tracking-widest">Add Labor Hours</label>
                              <div className="relative">
                                <PlusCircle className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-dashboard-accent" />
                                <input
                                  type="number"
                                  step="0.1"
                                  value={addLabor}
                                  onChange={(e) => setAddLabor(e.target.value)}
                                  className="w-full bg-dashboard-accent/10 border border-dashboard-accent/30 rounded-xl py-4 pl-12 pr-4 focus:border-dashboard-accent outline-none transition-colors text-lg font-bold"
                                  placeholder="+0.0"
                                />
                              </div>
                            </div>
                            <div className="space-y-2">
                              <label className="text-[10px] font-bold uppercase tracking-widest">Current Total Hours</label>
                              <input
                                type="number"
                                step="0.1"
                                value={usedLabor}
                                onChange={(e) => setUsedLabor(e.target.value)}
                                className="w-full bg-black/20 border border-white/20 rounded-xl py-2 px-4 focus:border-dashboard-accent outline-none transition-colors text-sm"
                              />
                            </div>
                          </div>


                        </div>

                        <div className="space-y-4">
                          <div className="space-y-2">
                            <label className="text-[10px] font-bold uppercase tracking-widest">Add Other Direct Cost ($)</label>
                            <div className="relative">
                              <PlusCircle className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-dashboard-accent" />
                              <input
                                type="number"
                                step="0.01"
                                value={addOdc}
                                onChange={(e) => setAddOdc(e.target.value)}
                                className="w-full bg-dashboard-accent/10 border border-dashboard-accent/30 rounded-xl py-4 pl-12 pr-4 focus:border-dashboard-accent outline-none transition-colors text-lg font-bold"
                                placeholder="+$0.00"
                              />
                            </div>
                          </div>
                          <div className="space-y-2">
                            <label className="text-[10px] font-bold uppercase tracking-widest">Current Total Other Direct Cost</label>
                            <input
                              type="number"
                              step="0.01"
                              value={usedOdc}
                              onChange={(e) => setUsedOdc(e.target.value)}
                              className="w-full bg-black/20 border border-white/20 rounded-xl py-2 px-4 focus:border-dashboard-accent outline-none transition-colors text-sm"
                            />
                          </div>
                        </div>
                        <div className="p-4 bg-white/5 rounded-xl border border-white/20 flex justify-between items-center">
                          <div className="text-xs">
                            Estimates: <span className="font-bold text-white">{selectedProject.est_labor_hours}h Labor</span> / <span className="font-bold text-white">${selectedProject.est_odc.toLocaleString()} Other Direct Cost</span>
                          </div>
                          <div className="text-xs">
                            Current: <span className="font-bold text-white">{selectedProject.used_labor_hours}h Labor</span> / <span className="font-bold text-white">${selectedProject.used_odc.toLocaleString()} Other Direct Cost</span>
                          </div>
                        </div>
                      </div>
                    ) : editMode === 'materials' ? (
                      <div className="space-y-6">
                        {/* Combined Material Summary */}
                        <div className="grid grid-cols-3 gap-3">
                          <div className="bg-white/5 border border-white/10 rounded-xl p-3 text-center">
                            <div className="text-[10px] font-bold uppercase tracking-widest opacity-60 mb-1">All Materials</div>
                            <div className="text-lg font-bold">{materialTotals.totalUsed.toLocaleString()} <span className="text-sm opacity-50">/ {materialTotals.totalQty.toLocaleString()}</span></div>
                            <div className={cn("text-xs font-bold", materialTotals.totalRemaining < 0 ? "text-red-400" : "text-emerald-400")}>
                              {materialTotals.totalRemaining.toLocaleString()} remaining
                            </div>
                          </div>
                          <div className="bg-white/5 border border-white/10 rounded-xl p-3 text-center">
                            <div className="text-[10px] font-bold uppercase tracking-widest opacity-60 mb-1">Est. Labor (All)</div>
                            <div className="text-lg font-bold">{materialTotals.totalLaborEst.toLocaleString()} <span className="text-sm opacity-50">hrs</span></div>
                          </div>
                          <div className="bg-white/5 border border-white/10 rounded-xl p-3 text-center">
                            <div className="text-[10px] font-bold uppercase tracking-widest opacity-60 mb-1">Actual Hours Worked</div>
                            <div className="text-lg font-bold text-amber-400">{materialTotals.totalActualHours.toLocaleString()} <span className="text-sm opacity-50">hrs</span></div>
                            <div className={cn("text-xs font-bold", (materialTotals.totalLaborEst - materialTotals.totalActualHours) < 0 ? "text-red-400" : "text-emerald-400")}>
                              {(materialTotals.totalLaborEst - materialTotals.totalActualHours).toLocaleString()} remaining
                            </div>
                          </div>
                        </div>

                        {/* ===== PROPOSAL UPLOAD PANEL ===== */}
                        <div className="border border-violet-500/30 rounded-xl overflow-hidden">
                          <div className="bg-gradient-to-r from-violet-500/10 to-fuchsia-500/10 px-4 py-3 flex items-center justify-between">
                            <div className="text-xs font-bold uppercase tracking-widest text-violet-400 flex items-center gap-2">
                              <Upload size={14} /> Upload Proposal — AI Extraction
                            </div>
                            {proposalMaterials.length > 0 && (
                              <button type="button" onClick={() => { setProposalMaterials([]); setProposalError(''); }} className="text-[10px] opacity-60 hover:opacity-100 transition-opacity">Clear</button>
                            )}
                          </div>
                          <div className="p-4 space-y-3">
                            {proposalMaterials.length === 0 && !proposalLoading ? (
                              // File upload zone
                              <label className="flex flex-col items-center gap-3 py-8 cursor-pointer border-2 border-dashed border-violet-500/30 rounded-xl hover:bg-violet-500/5 hover:border-violet-500/50 transition-all">
                                <div className="w-12 h-12 rounded-full bg-violet-500/10 flex items-center justify-center">
                                  <Upload size={20} className="text-violet-400" />
                                </div>
                                <div className="text-center">
                                  <div className="text-sm font-bold text-violet-400">Upload Any Document</div>
                                  <div className="text-[10px] opacity-50 mt-1">Excel • PDF • Word • Images • CSV • Any file — AI will extract materials & labor hours</div>
                                </div>
                                <input
                                  type="file"
                                  className="hidden"
                                  onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) handleProposalUpload(file);
                                    e.target.value = '';
                                  }}
                                />
                              </label>
                            ) : proposalLoading ? (
                              // Loading state
                              <div className="flex flex-col items-center gap-3 py-8">
                                <div className="w-10 h-10 border-3 border-violet-500/30 border-t-violet-400 rounded-full animate-spin" />
                                <div className="text-sm text-violet-400 font-bold">Extracting materials with AI...</div>
                                <div className="text-[10px] opacity-50">Analyzing document for materials, quantities, and labor hours</div>
                              </div>
                            ) : (
                              // Preview extracted materials
                              <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                  <div className="text-sm font-bold text-violet-400">{proposalMaterials.filter(m => m.selected).length} of {proposalMaterials.length} materials selected</div>
                                  <div className="flex items-center gap-3">
                                    <button type="button" onClick={() => setProposalMaterials(prev => prev.map(m => ({ ...m, selected: true })))} className="text-[9px] uppercase tracking-wider text-violet-400 hover:text-violet-300">Select All</button>
                                    <button type="button" onClick={() => setProposalMaterials(prev => prev.map(m => ({ ...m, selected: false })))} className="text-[9px] uppercase tracking-wider opacity-50 hover:opacity-80">None</button>
                                  </div>
                                </div>

                                <div className="max-h-64 overflow-y-auto space-y-1 rounded-lg">
                                  <div className={`grid ${showPricing ? 'grid-cols-[auto_2fr_0.7fr_0.7fr_0.7fr]' : 'grid-cols-[auto_2fr_0.7fr_0.7fr]'} gap-2 px-3 py-1.5 text-[9px] font-bold uppercase tracking-widest opacity-50 sticky top-0 bg-dashboard-bg`}>
                                    <div></div>
                                    <div>Material</div>
                                    <div className="text-center">Qty</div>
                                    <div className="text-center">Hrs/Unit</div>
                                    {showPricing && <div className="text-center">Cost/Unit</div>}
                                  </div>
                                  {proposalMaterials.map((mat, idx) => (
                                    <div key={idx} className={cn(`grid ${showPricing ? 'grid-cols-[auto_2fr_0.7fr_0.7fr_0.7fr]' : 'grid-cols-[auto_2fr_0.7fr_0.7fr]'} gap-2 px-3 py-2 rounded-lg items-center transition-all`, mat.selected ? "bg-violet-500/10 border border-violet-500/20" : "bg-white/5 border border-transparent opacity-50")}>
                                      <input type="checkbox" checked={mat.selected} onChange={() => setProposalMaterials(prev => prev.map((m, i) => i === idx ? { ...m, selected: !m.selected } : m))} className="w-4 h-4 rounded accent-violet-500" />
                                      <input type="text" value={mat.name} onChange={(e) => setProposalMaterials(prev => prev.map((m, i) => i === idx ? { ...m, name: e.target.value } : m))} className="bg-transparent border-b border-white/10 focus:border-violet-400 outline-none text-sm py-1" />
                                      <input type="number" value={mat.quantity} onChange={(e) => setProposalMaterials(prev => prev.map((m, i) => i === idx ? { ...m, quantity: parseFloat(e.target.value) || 0 } : m))} className="bg-transparent border-b border-white/10 focus:border-violet-400 outline-none text-sm text-center py-1 w-full" min="0" step="1" />
                                      <input type="number" value={mat.labor_hours_per_unit} onChange={(e) => setProposalMaterials(prev => prev.map((m, i) => i === idx ? { ...m, labor_hours_per_unit: parseFloat(e.target.value) || 0 } : m))} className="bg-transparent border-b border-white/10 focus:border-violet-400 outline-none text-sm text-center py-1 w-full" min="0" step="0.01" />
                                      {showPricing && <input type="number" value={mat.unit_cost} onChange={(e) => setProposalMaterials(prev => prev.map((m, i) => i === idx ? { ...m, unit_cost: parseFloat(e.target.value) || 0 } : m))} className="bg-transparent border-b border-white/10 focus:border-violet-400 outline-none text-sm text-center py-1 w-full" min="0" step="0.01" />}
                                    </div>
                                  ))}
                                </div>

                                {/* Import as add-on toggle + import buttons */}
                                <div className="flex items-center justify-between pt-2 border-t border-white/10">
                                  <label className="flex items-center gap-2 cursor-pointer">
                                    <input type="checkbox" checked={proposalAsAddon} onChange={() => setProposalAsAddon(!proposalAsAddon)} className="w-4 h-4 rounded accent-amber-500" />
                                    <span className={cn("text-xs font-bold uppercase tracking-wider", proposalAsAddon ? "text-amber-400" : "opacity-60")}>
                                      {proposalAsAddon ? 'Import as Add-On / Change Order' : 'Import as Original Material'}
                                    </span>
                                  </label>
                                  <div className="flex items-center gap-2">
                                    <button type="button" onClick={() => { setProposalMaterials([]); setProposalError(''); }} className="px-4 py-2 bg-white/5 border border-white/20 rounded-lg text-xs font-bold uppercase tracking-wider hover:bg-white/10 transition-all">
                                      Cancel
                                    </button>
                                    <button type="button" onClick={handleProposalImport} disabled={proposalMaterials.filter(m => m.selected).length === 0 || proposalLoading} className="px-5 py-2 bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white font-bold rounded-lg text-xs uppercase tracking-wider hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-30 flex items-center gap-2">
                                      <Download size={12} /> Import {proposalMaterials.filter(m => m.selected).length} Materials
                                    </button>
                                  </div>
                                </div>
                              </div>
                            )}

                            {proposalError && (
                              <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 text-sm text-red-400 flex items-center gap-2">
                                <span className="text-red-500 font-bold">⚠</span> {proposalError}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* ============ ORIGINAL MATERIALS SECTION ============ */}
                        <div className="border border-dashboard-accent/30 rounded-xl overflow-hidden">
                          <div className="bg-dashboard-accent/10 px-4 py-3 flex items-center justify-between">
                            <div className="text-xs font-bold uppercase tracking-widest text-dashboard-accent flex items-center gap-2">
                              <span className="w-2 h-2 rounded-full bg-dashboard-accent" /> Original Materials
                            </div>
                            <div className="text-[10px] opacity-60">{originalMaterials.length} item{originalMaterials.length !== 1 ? 's' : ''}</div>
                          </div>
                          <div className="p-4 space-y-3">
                            {/* Original Summary */}
                            {originalMaterials.length > 0 && (
                              <div className="grid grid-cols-3 gap-2 text-xs">
                                <div className="bg-white/5 rounded-lg p-2 text-center">
                                  <div className="opacity-50 text-[9px] uppercase">Qty</div>
                                  <div className="font-bold">{origTotals.totalUsed} / {origTotals.totalQty}</div>
                                </div>
                                <div className="bg-white/5 rounded-lg p-2 text-center">
                                  <div className="opacity-50 text-[9px] uppercase">Labor Est</div>
                                  <div className="font-bold">{origTotals.totalLaborEst.toLocaleString()}h</div>
                                </div>
                                <div className="bg-white/5 rounded-lg p-2 text-center">
                                  <div className="opacity-50 text-[9px] uppercase">Actual</div>
                                  <div className={cn("font-bold", origTotals.totalActualHours > origTotals.totalLaborEst ? "text-red-400" : "text-amber-400")}>
                                    {origTotals.totalActualHours.toLocaleString()}h
                                  </div>
                                </div>
                              </div>
                            )}

                            {/* Original Material List */}
                            {loadingMaterials ? (
                              <div className="text-center py-8 opacity-50">Loading materials...</div>
                            ) : originalMaterials.length === 0 ? (
                              <div className="text-center py-4 opacity-50 text-sm">No original materials added yet.</div>
                            ) : (
                              <div className="space-y-2">
                                {/* Table Header */}
                                <div className={`grid ${showPricing ? 'grid-cols-[2fr_0.6fr_0.6fr_0.6fr_0.6fr_0.7fr_0.9fr_0.8fr_auto]' : 'grid-cols-[2fr_0.6fr_0.6fr_0.6fr_0.9fr_0.8fr_auto]'} gap-2 px-3 py-2 text-[9px] font-bold uppercase tracking-widest opacity-60`}>
                                  <div>Material</div>
                                  <div className="text-center">Needed</div>
                                  <div className="text-center">Installed</div>
                                  <div className="text-center">Remaining</div>
                                  {showPricing && <div className="text-center">$/Unit</div>}
                                  {showPricing && <div className="text-center">Ext. Cost</div>}
                                  <div className="text-center">Hours (Actual / Est)</div>
                                  <div className="text-center">Action</div>
                                  <div></div>
                                </div>
                                {originalMaterials.map(mat => {
                                  const remaining = mat.quantity - mat.quantity_used;
                                  const laborEst = mat.quantity * mat.labor_hours_per_unit;
                                  const actualHrs = mat.actual_labor_hours || 0;
                                  const progress = mat.quantity > 0 ? (mat.quantity_used / mat.quantity) * 100 : 0;
                                  const isLogging = logMaterialId === mat.id;
                                  const extCost = mat.quantity * (mat.unit_cost || 0);
                                  return (
                                    <div key={mat.id} className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
                                      <div className={`grid ${showPricing ? 'grid-cols-[2fr_0.6fr_0.6fr_0.6fr_0.6fr_0.7fr_0.9fr_0.8fr_auto]' : 'grid-cols-[2fr_0.6fr_0.6fr_0.6fr_0.9fr_0.8fr_auto]'} gap-2 items-center px-3 py-3`}>
                                        <div>
                                          <div className="font-bold text-sm">{mat.name}</div>
                                          <div className="text-[10px] opacity-50">{mat.labor_hours_per_unit}h per unit</div>
                                          <div className="w-full h-1.5 bg-white/10 rounded-full mt-1.5 overflow-hidden">
                                            <div className={cn("h-full rounded-full", progress > 100 ? "bg-red-500" : "bg-dashboard-accent")} style={{ width: `${Math.min(progress, 100)}%` }} />
                                          </div>
                                        </div>
                                        <div className="text-center font-bold">{mat.quantity.toLocaleString()}</div>
                                        <div className="text-center font-bold text-dashboard-accent">{mat.quantity_used.toLocaleString()}</div>
                                        <div className={cn("text-center font-bold", remaining < 0 ? "text-red-400" : "text-emerald-400")}>
                                          {remaining.toLocaleString()}
                                        </div>
                                        {showPricing && (
                                          editingCostId === mat.id ? (
                                            <input
                                              type="number"
                                              autoFocus
                                              defaultValue={(mat.unit_cost || 0).toFixed(2)}
                                              className="w-full bg-black/80 border-2 border-dashboard-accent rounded-lg px-2 py-1 text-center text-sm font-bold outline-none text-white"
                                              min="0" step="0.01"
                                              onBlur={(e) => handleUpdateMaterialCost(mat.id, parseFloat(e.target.value) || 0)}
                                              onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); if (e.key === 'Escape') setEditingCostId(null); }}
                                            />
                                          ) : (
                                            <button
                                              type="button"
                                              className="w-full text-center text-sm font-bold px-2 py-1 rounded-lg border border-transparent hover:border-dashboard-accent/50 hover:bg-dashboard-accent/10 cursor-pointer transition-all group"
                                              onClick={() => setEditingCostId(mat.id)}
                                            >
                                              ${(mat.unit_cost || 0).toFixed(2)} <span className="text-[9px] opacity-0 group-hover:opacity-60 transition-opacity">✏️</span>
                                            </button>
                                          )
                                        )}
                                        {showPricing && <div className="text-center text-sm font-bold text-emerald-400">${extCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>}
                                        <div className="text-center text-sm">
                                          <span className="font-bold text-amber-400">{actualHrs.toLocaleString()}h</span>
                                          <span className="opacity-50"> / {laborEst.toLocaleString()}h</span>
                                        </div>
                                        <div className="text-center">
                                          <button
                                            type="button"
                                            onClick={() => {
                                              if (isLogging) {
                                                setLogMaterialId(null);
                                                setLogQty(''); setLogHours(''); setLogCost('');
                                              } else {
                                                setLogMaterialId(mat.id);
                                                setLogQty(''); setLogHours('');
                                                setLogCost((mat.unit_cost || 0).toString());
                                              }
                                            }}
                                            className={cn(
                                              "px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all",
                                              isLogging
                                                ? "bg-white/10 text-white"
                                                : "bg-dashboard-accent/20 text-dashboard-accent hover:bg-dashboard-accent/30"
                                            )}
                                          >
                                            {isLogging ? 'Cancel' : '+ Log Install'}
                                          </button>
                                        </div>
                                        <div className="text-center">
                                          <button
                                            type="button"
                                            onClick={() => handleDeleteMaterial(mat.id)}
                                            className="p-1.5 rounded-lg hover:bg-red-500/20 hover:text-red-400 transition-all opacity-40 hover:opacity-100"
                                          >
                                            <Trash2 size={14} />
                                          </button>
                                        </div>
                                      </div>
                                      {/* Expandable Log Install Form */}
                                      {isLogging && (
                                        <div className="px-3 pb-3 pt-1 bg-dashboard-accent/5 border-t border-dashboard-accent/20">
                                          <div className="grid grid-cols-[1fr_1fr_auto] gap-3 items-end">
                                            <div>
                                              <label className="text-[9px] font-bold uppercase tracking-widest opacity-60 block mb-1">Qty Installed Today</label>
                                              <input
                                                type="number"
                                                value={logQty}
                                                onChange={(e) => setLogQty(e.target.value)}
                                                placeholder="e.g. 50"
                                                className="w-full bg-black/40 border border-white/20 rounded-lg py-2 px-3 text-sm font-bold focus:border-dashboard-accent outline-none"
                                                min="0"
                                                step="1"
                                                autoFocus
                                              />
                                            </div>
                                            <div>
                                              <label className="text-[9px] font-bold uppercase tracking-widest opacity-60 block mb-1">Hours Worked</label>
                                              <input
                                                type="number"
                                                value={logHours}
                                                onChange={(e) => setLogHours(e.target.value)}
                                                placeholder="e.g. 4"
                                                className="w-full bg-black/40 border border-white/20 rounded-lg py-2 px-3 text-sm font-bold focus:border-dashboard-accent outline-none"
                                                min="0"
                                                step="0.25"
                                              />
                                            </div>
                                            <button
                                              type="button"
                                              onClick={() => handleLogInstall(mat.id)}
                                              disabled={(!logQty || parseFloat(logQty) <= 0) && (!logHours || parseFloat(logHours) <= 0) && !(showPricing && logCost && parseFloat(logCost) !== (mat.unit_cost || 0))}
                                              className="bg-dashboard-accent text-black font-bold py-2 px-5 rounded-lg text-xs uppercase tracking-wider hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-30"
                                            >
                                              Submit
                                            </button>
                                          </div>
                                          {showPricing && (
                                            <div className="mt-3 pt-3 border-t border-white/10">
                                              <label className="text-[9px] font-bold uppercase tracking-widest opacity-60 block mb-1">💰 Unit Cost ($)</label>
                                              <input
                                                type="number"
                                                value={logCost}
                                                onChange={(e) => setLogCost(e.target.value)}
                                                placeholder="e.g. 25.00"
                                                className="w-full bg-black/40 border border-emerald-500/40 rounded-lg py-2 px-3 text-sm font-bold text-emerald-400 focus:border-emerald-400 outline-none"
                                                min="0"
                                                step="0.01"
                                              />
                                            </div>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            )}

                            {/* Upload CSV */}
                            <div className="bg-white/5 border border-dashed border-white/20 rounded-xl p-4 space-y-3">
                              <div className="flex items-center justify-between">
                                <div className="text-[10px] font-bold uppercase tracking-widest flex items-center gap-1.5">
                                  <FileSpreadsheet size={12} className="text-dashboard-accent" />
                                  Import from CSV
                                </div>
                                <span className="text-[9px] opacity-40">Columns: Material, Quantity, Labor Hrs/Unit</span>
                              </div>
                              {csvPreview.length > 0 ? (
                                <div className="space-y-2">
                                  <div className="text-xs font-bold text-dashboard-accent">{csvPreview.length} materials ready to import:</div>
                                  <div className="max-h-40 overflow-y-auto space-y-1">
                                    {csvPreview.map((row, i) => (
                                      <div key={i} className="grid grid-cols-3 gap-2 text-xs bg-black/20 rounded-lg px-3 py-1.5">
                                        <span className="font-bold truncate">{row.name}</span>
                                        <span className="text-center">Qty: {row.quantity}</span>
                                        <span className="text-center">{row.labor_hours_per_unit} hrs/unit</span>
                                      </div>
                                    ))}
                                  </div>
                                  <div className="flex gap-2">
                                    <button
                                      type="button"
                                      onClick={() => setCsvPreview([])}
                                      className="flex-1 py-2 bg-white/5 border border-white/20 rounded-xl text-xs font-bold uppercase tracking-wider hover:bg-white/10 transition-all"
                                    >
                                      Cancel
                                    </button>
                                    <button
                                      type="button"
                                      disabled={csvUploading}
                                      onClick={async () => {
                                        if (!selectedProject) return;
                                        setCsvUploading(true);
                                        try {
                                          for (const row of csvPreview) {
                                            await fetch(`/api/projects/${selectedProject.id}/materials`, {
                                              method: 'POST',
                                              headers: authHeaders(),
                                              body: JSON.stringify(row),
                                            });
                                          }
                                          setCsvPreview([]);
                                          fetchMaterials(selectedProject.id, authToken!);
                                        } catch (err) {
                                          console.error('CSV import failed', err);
                                          alert('Some materials failed to import.');
                                        } finally {
                                          setCsvUploading(false);
                                        }
                                      }}
                                      className="flex-1 py-2 bg-dashboard-accent text-black font-bold rounded-xl text-xs uppercase tracking-wider hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                                    >
                                      {csvUploading ? 'Importing...' : `Import ${csvPreview.length} Materials`}
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <label className="flex flex-col items-center gap-2 py-4 cursor-pointer hover:bg-white/5 rounded-xl transition-colors">
                                  <Upload size={20} className="text-dashboard-accent opacity-60" />
                                  <span className="text-xs opacity-60">Click to upload CSV file</span>
                                  <input
                                    type="file"
                                    accept=".csv,.txt"
                                    className="hidden"
                                    onChange={(e) => {
                                      const file = e.target.files?.[0];
                                      if (!file) return;
                                      const reader = new FileReader();
                                      reader.onload = (evt) => {
                                        const text = evt.target?.result as string;
                                        if (!text) return;
                                        const lines = text.split(/\r?\n/).filter(l => l.trim());
                                        if (lines.length < 2) { alert('CSV must have a header row and at least one data row.'); return; }
                                        // Parse header to find column indices
                                        const header = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/[^a-z]/g, ''));
                                        const nameIdx = header.findIndex(h => h.includes('material') || h.includes('name') || h.includes('item') || h.includes('description'));
                                        const qtyIdx = header.findIndex(h => h.includes('qty') || h.includes('quantity') || h.includes('count'));
                                        const laborIdx = header.findIndex(h => h.includes('labor') || h.includes('hour') || h.includes('hrs') || h.includes('time'));
                                        if (nameIdx === -1 || laborIdx === -1) {
                                          alert('CSV must have columns for Material (name/item/description) and Labor (hours/hrs/time). Quantity column is optional (defaults to 1).');
                                          return;
                                        }
                                        const parsed: { name: string; quantity: number; labor_hours_per_unit: number }[] = [];
                                        for (let i = 1; i < lines.length; i++) {
                                          const cols = lines[i].split(',').map(c => c.trim().replace(/^"|"$/g, ''));
                                          const name = cols[nameIdx];
                                          const qty = qtyIdx !== -1 ? (parseFloat(cols[qtyIdx]) || 1) : 1;
                                          const labor = parseFloat(cols[laborIdx]) || 0;
                                          if (name && labor > 0) {
                                            parsed.push({ name, quantity: qty, labor_hours_per_unit: labor });
                                          }
                                        }
                                        if (parsed.length === 0) {
                                          alert('No valid rows found. Each row needs a material name and labor hours > 0.');
                                          return;
                                        }
                                        setCsvPreview(parsed);
                                      };
                                      reader.readAsText(file);
                                      e.target.value = '';
                                    }}
                                  />
                                </label>
                              )}
                            </div>

                            {/* Add Original Material Form */}
                            <div className="bg-dashboard-accent/5 border border-dashboard-accent/20 rounded-xl p-4 space-y-3">
                              <div className="text-[10px] font-bold uppercase tracking-widest text-dashboard-accent">Add Original Material</div>
                              <div className={`grid ${showPricing ? 'grid-cols-[2fr_1fr_1fr_1fr]' : 'grid-cols-[2fr_1fr_1fr]'} gap-3`}>
                                <input type="text" value={matName} onChange={(e) => setMatName(e.target.value)} placeholder="Material name (e.g. Cat6 Cable)" className="bg-black/40 border border-white/20 rounded-xl py-2.5 px-4 focus:border-dashboard-accent outline-none transition-colors text-sm" />
                                <input type="number" value={matQty} onChange={(e) => setMatQty(e.target.value)} placeholder="Quantity" className="bg-black/40 border border-white/20 rounded-xl py-2.5 px-4 focus:border-dashboard-accent outline-none transition-colors text-sm" min="1" step="1" />
                                <input type="number" value={matLaborPerUnit} onChange={(e) => setMatLaborPerUnit(e.target.value)} placeholder="Labor hrs/unit" className="bg-black/40 border border-white/20 rounded-xl py-2.5 px-4 focus:border-dashboard-accent outline-none transition-colors text-sm" min="0" step="0.1" />
                                {showPricing && <input type="number" value={matCost} onChange={(e) => setMatCost(e.target.value)} placeholder="$ Cost/unit" className="bg-black/40 border border-white/20 rounded-xl py-2.5 px-4 focus:border-dashboard-accent outline-none transition-colors text-sm" min="0" step="0.01" />}
                              </div>
                              <button type="button" onClick={() => handleAddMaterial(false)} disabled={!matName || !matQty} className="w-full bg-dashboard-accent text-black font-bold py-2.5 rounded-xl hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-30 text-xs uppercase tracking-wider flex items-center justify-center gap-2">
                                <PlusCircle size={14} /> Add Material
                              </button>
                            </div>
                          </div>{/* close p-4 space-y-3 */}
                        </div>{/* close original materials border section */}

                        {/* ============ ADD-ONS / CHANGE ORDERS SECTION ============ */}
                        <div className="border border-amber-500/30 rounded-xl overflow-hidden">
                          <div className="bg-amber-500/10 px-4 py-3 flex items-center justify-between">
                            <div className="text-xs font-bold uppercase tracking-widest text-amber-400 flex items-center gap-2">
                              <span className="w-2 h-2 rounded-full bg-amber-400" /> Add-Ons / Change Orders
                            </div>
                            <div className="text-[10px] opacity-60">{addonMaterials.length} item{addonMaterials.length !== 1 ? 's' : ''}</div>
                          </div>
                          <div className="p-4 space-y-3">
                            {/* Add-On Summary */}
                            {addonMaterials.length > 0 && (
                              <div className="grid grid-cols-3 gap-2 text-xs">
                                <div className="bg-amber-500/5 border border-amber-500/10 rounded-lg p-2 text-center">
                                  <div className="opacity-50 text-[9px] uppercase">Qty</div>
                                  <div className="font-bold">{addonTotals.totalUsed} / {addonTotals.totalQty}</div>
                                </div>
                                <div className="bg-amber-500/5 border border-amber-500/10 rounded-lg p-2 text-center">
                                  <div className="opacity-50 text-[9px] uppercase">Labor Est</div>
                                  <div className="font-bold">{addonTotals.totalLaborEst.toLocaleString()}h</div>
                                </div>
                                <div className="bg-amber-500/5 border border-amber-500/10 rounded-lg p-2 text-center">
                                  <div className="opacity-50 text-[9px] uppercase">Actual</div>
                                  <div className={cn("font-bold", addonTotals.totalActualHours > addonTotals.totalLaborEst ? "text-red-400" : "text-amber-400")}>
                                    {addonTotals.totalActualHours.toLocaleString()}h
                                  </div>
                                </div>
                              </div>
                            )}

                            {/* Add-On Material List */}
                            {addonMaterials.length === 0 ? (
                              <div className="text-center py-4 opacity-50 text-sm">No add-ons or change orders yet.</div>
                            ) : (
                              <div className="space-y-2">
                                <div className={`grid ${showPricing ? 'grid-cols-[2fr_0.6fr_0.6fr_0.6fr_0.6fr_0.7fr_0.9fr_0.8fr_auto]' : 'grid-cols-[2fr_0.6fr_0.6fr_0.6fr_0.9fr_0.8fr_auto]'} gap-2 px-3 py-2 text-[9px] font-bold uppercase tracking-widest opacity-60`}>
                                  <div>Material</div>
                                  <div className="text-center">Needed</div>
                                  <div className="text-center">Installed</div>
                                  <div className="text-center">Remaining</div>
                                  {showPricing && <div className="text-center">$/Unit</div>}
                                  {showPricing && <div className="text-center">Ext. Cost</div>}
                                  <div className="text-center">Hours (Actual / Est)</div>
                                  <div className="text-center">Action</div>
                                  <div></div>
                                </div>
                                {addonMaterials.map(mat => {
                                  const remaining = mat.quantity - mat.quantity_used;
                                  const laborEst = mat.quantity * mat.labor_hours_per_unit;
                                  const actualHrs = mat.actual_labor_hours || 0;
                                  const progress = mat.quantity > 0 ? (mat.quantity_used / mat.quantity) * 100 : 0;
                                  const isLogging = logMaterialId === mat.id;
                                  const extCost = mat.quantity * (mat.unit_cost || 0);
                                  return (
                                    <div key={mat.id} className="bg-amber-500/5 border border-amber-500/15 rounded-xl overflow-hidden">
                                      <div className={`grid ${showPricing ? 'grid-cols-[2fr_0.6fr_0.6fr_0.6fr_0.6fr_0.7fr_0.9fr_0.8fr_auto]' : 'grid-cols-[2fr_0.6fr_0.6fr_0.6fr_0.9fr_0.8fr_auto]'} gap-2 items-center px-3 py-3`}>
                                        <div>
                                          <div className="font-bold text-sm flex items-center gap-1.5">{mat.name} <span className="text-[8px] font-bold uppercase px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400">ADD-ON</span></div>
                                          <div className="text-[10px] opacity-50">{mat.labor_hours_per_unit}h per unit</div>
                                          <div className="w-full h-1.5 bg-white/10 rounded-full mt-1.5 overflow-hidden">
                                            <div className={cn("h-full rounded-full", progress > 100 ? "bg-red-500" : "bg-amber-400")} style={{ width: `${Math.min(progress, 100)}%` }} />
                                          </div>
                                        </div>
                                        <div className="text-center font-bold">{mat.quantity.toLocaleString()}</div>
                                        <div className="text-center font-bold text-amber-400">{mat.quantity_used.toLocaleString()}</div>
                                        <div className={cn("text-center font-bold", remaining < 0 ? "text-red-400" : "text-emerald-400")}>
                                          {remaining.toLocaleString()}
                                        </div>
                                        {showPricing && (
                                          editingCostId === mat.id ? (
                                            <input
                                              type="number"
                                              autoFocus
                                              defaultValue={(mat.unit_cost || 0).toFixed(2)}
                                              className="w-full bg-black/80 border-2 border-amber-400 rounded-lg px-2 py-1 text-center text-sm font-bold outline-none text-white"
                                              min="0" step="0.01"
                                              onBlur={(e) => handleUpdateMaterialCost(mat.id, parseFloat(e.target.value) || 0)}
                                              onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); if (e.key === 'Escape') setEditingCostId(null); }}
                                            />
                                          ) : (
                                            <button
                                              type="button"
                                              className="w-full text-center text-sm font-bold px-2 py-1 rounded-lg border border-transparent hover:border-amber-400/50 hover:bg-amber-400/10 cursor-pointer transition-all group"
                                              onClick={() => setEditingCostId(mat.id)}
                                            >
                                              ${(mat.unit_cost || 0).toFixed(2)} <span className="text-[9px] opacity-0 group-hover:opacity-60 transition-opacity">✏️</span>
                                            </button>
                                          )
                                        )}
                                        {showPricing && <div className="text-center text-sm font-bold text-emerald-400">${extCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>}
                                        <div className="text-center text-sm">
                                          <span className="font-bold text-amber-400">{actualHrs.toLocaleString()}h</span>
                                          <span className="opacity-50"> / {laborEst.toLocaleString()}h</span>
                                        </div>
                                        <div className="text-center">
                                          <button type="button" onClick={() => { if (isLogging) { setLogMaterialId(null); setLogQty(''); setLogHours(''); setLogCost(''); } else { setLogMaterialId(mat.id); setLogQty(''); setLogHours(''); setLogCost((mat.unit_cost || 0).toString()); } }} className={cn("px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all", isLogging ? "bg-white/10 text-white" : "bg-amber-500/20 text-amber-400 hover:bg-amber-500/30")}>
                                            {isLogging ? 'Cancel' : '+ Log Install'}
                                          </button>
                                        </div>
                                        <div className="text-center">
                                          <button type="button" onClick={() => handleDeleteMaterial(mat.id)} className="p-1.5 rounded-lg hover:bg-red-500/20 hover:text-red-400 transition-all opacity-40 hover:opacity-100">
                                            <Trash2 size={14} />
                                          </button>
                                        </div>
                                      </div>
                                      {isLogging && (
                                        <div className="px-3 pb-3 pt-1 bg-amber-500/5 border-t border-amber-500/20">
                                          <div className="grid grid-cols-[1fr_1fr_auto] gap-3 items-end">
                                            <div>
                                              <label className="text-[9px] font-bold uppercase tracking-widest opacity-60 block mb-1">Qty Installed Today</label>
                                              <input type="number" value={logQty} onChange={(e) => setLogQty(e.target.value)} placeholder="e.g. 50" className="w-full bg-black/40 border border-white/20 rounded-lg py-2 px-3 text-sm font-bold focus:border-amber-400 outline-none" min="0" step="1" autoFocus />
                                            </div>
                                            <div>
                                              <label className="text-[9px] font-bold uppercase tracking-widest opacity-60 block mb-1">Hours Worked</label>
                                              <input type="number" value={logHours} onChange={(e) => setLogHours(e.target.value)} placeholder="e.g. 4" className="w-full bg-black/40 border border-white/20 rounded-lg py-2 px-3 text-sm font-bold focus:border-amber-400 outline-none" min="0" step="0.25" />
                                            </div>
                                            <button type="button" onClick={() => handleLogInstall(mat.id)} disabled={(!logQty || parseFloat(logQty) <= 0) && (!logHours || parseFloat(logHours) <= 0) && !(showPricing && logCost && parseFloat(logCost) !== (mat.unit_cost || 0))} className="bg-amber-500 text-black font-bold py-2 px-5 rounded-lg text-xs uppercase tracking-wider hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-30">
                                              Submit
                                            </button>
                                          </div>
                                          {showPricing && (
                                            <div className="mt-3 pt-3 border-t border-white/10">
                                              <label className="text-[9px] font-bold uppercase tracking-widest opacity-60 block mb-1">💰 Unit Cost ($)</label>
                                              <input
                                                type="number"
                                                value={logCost}
                                                onChange={(e) => setLogCost(e.target.value)}
                                                placeholder="e.g. 25.00"
                                                className="w-full bg-black/40 border border-emerald-500/40 rounded-lg py-2 px-3 text-sm font-bold text-emerald-400 focus:border-emerald-400 outline-none"
                                                min="0"
                                                step="0.01"
                                              />
                                            </div>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            )}

                            {/* Add Add-On Form */}
                            <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-4 space-y-3">
                              <div className="text-[10px] font-bold uppercase tracking-widest text-amber-400">Add Change Order / Add-On Material</div>
                              <div className={`grid ${showPricing ? 'grid-cols-[2fr_1fr_1fr_1fr]' : 'grid-cols-[2fr_1fr_1fr]'} gap-3`}>
                                <input type="text" value={matName} onChange={(e) => setMatName(e.target.value)} placeholder="Material name" className="bg-black/40 border border-white/20 rounded-xl py-2.5 px-4 focus:border-amber-400 outline-none transition-colors text-sm" />
                                <input type="number" value={matQty} onChange={(e) => setMatQty(e.target.value)} placeholder="Quantity" className="bg-black/40 border border-white/20 rounded-xl py-2.5 px-4 focus:border-amber-400 outline-none transition-colors text-sm" min="1" step="1" />
                                <input type="number" value={matLaborPerUnit} onChange={(e) => setMatLaborPerUnit(e.target.value)} placeholder="Labor hrs/unit" className="bg-black/40 border border-white/20 rounded-xl py-2.5 px-4 focus:border-amber-400 outline-none transition-colors text-sm" min="0" step="0.1" />
                                {showPricing && <input type="number" value={matCost} onChange={(e) => setMatCost(e.target.value)} placeholder="$ Cost/unit" className="bg-black/40 border border-white/20 rounded-xl py-2.5 px-4 focus:border-amber-400 outline-none transition-colors text-sm" min="0" step="0.01" />}
                              </div>
                              <button type="button" onClick={() => handleAddMaterial(true)} disabled={!matName || !matQty} className="w-full bg-amber-500 text-black font-bold py-2.5 rounded-xl hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-30 text-xs uppercase tracking-wider flex items-center justify-center gap-2">
                                <PlusCircle size={14} /> Add Change Order
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold uppercase tracking-widest">Project Name</label>
                          <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="w-full bg-black/40 border border-white/20 rounded-xl py-3 px-4 focus:border-dashboard-accent outline-none transition-colors"
                            required
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <label className="text-[10px] font-bold uppercase tracking-widest">Lead Name</label>
                            <input
                              type="text"
                              value={leadName}
                              onChange={(e) => setLeadName(e.target.value)}
                              className="w-full bg-black/40 border border-white/20 rounded-xl py-3 px-4 focus:border-dashboard-accent outline-none transition-colors"
                              placeholder="e.g. John Doe"
                            />
                          </div>
                          <div className="space-y-2">
                            <label className="text-[10px] font-bold uppercase tracking-widest">Est. Labor Hours</label>
                            <input
                              type="number"
                              value={estLabor}
                              onChange={(e) => setEstLabor(e.target.value)}
                              className="w-full bg-black/40 border border-white/20 rounded-xl py-3 px-4 focus:border-dashboard-accent outline-none transition-colors"
                              required
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <label className="text-[10px] font-bold uppercase tracking-widest">Est. Other Direct Cost ($)</label>
                            <input
                              type="number"
                              value={estOdc}
                              onChange={(e) => setEstOdc(e.target.value)}
                              className="w-full bg-black/40 border border-white/20 rounded-xl py-3 px-4 focus:border-dashboard-accent outline-none transition-colors"
                              placeholder="0.00"
                            />
                          </div>
                          <div className="space-y-2">
                            <label className="text-[10px] font-bold uppercase tracking-widest">Project Deadline</label>
                            <input
                              type="date"
                              value={deadline}
                              onChange={(e) => setDeadline(e.target.value)}
                              className="w-full bg-black/40 border border-white/20 rounded-xl py-3 px-4 focus:border-dashboard-accent outline-none transition-colors"
                            />
                          </div>
                        </div>
                        {!selectedProject.completed_at && (
                          <div className="pt-4 flex justify-end">
                            <button
                              type="button"
                              onClick={async () => {
                                if (!confirm('Mark this project as completed? It will be removed from the dashboard in 30 days.')) return;
                                setIsUpdating(true);
                                try {
                                  await fetch(`/api/projects/${selectedProject.id}`, {
                                    method: 'PUT',
                                    headers: authHeaders(),
                                    body: JSON.stringify({ completed_at: new Date().toISOString() }),
                                  });
                                  setSelectedProject(null);
                                } catch (err) {
                                  console.error('Failed to complete project', err);
                                } finally {
                                  setIsUpdating(false);
                                }
                              }}
                              className="flex items-center gap-2 px-4 py-2 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-lg text-xs font-bold uppercase tracking-wider hover:bg-emerald-500/30 transition-all"
                            >
                              <CheckCircle2 size={14} />
                              Mark Completed
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={() => handleDelete(selectedProject.id)}
                        className="px-6 py-4 bg-red-500/10 border border-red-500/30 text-red-400 font-bold rounded-xl hover:bg-red-500/20 active:scale-[0.98] transition-all text-xs uppercase tracking-wider"
                      >
                        Delete
                      </button>
                      <button
                        disabled={isUpdating}
                        className="flex-1 bg-dashboard-accent text-black font-bold py-4 rounded-xl hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                      >
                        {isUpdating ? 'Syncing...' : 'Save Changes'}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Footer / Status Bar */}
      <footer className="border-t border-dashboard-line p-4 flex items-center justify-between text-[10px] uppercase tracking-[0.2em]">
        <div className="flex gap-6">
          <span>System: Active</span>
          <span>Sync: Real-Time</span>
          <span>Nodes: {projects.length}</span>
        </div>
        <div>
          Last Update: {new Date().toLocaleTimeString()}
        </div>
      </footer>
    </div >
  );
}
