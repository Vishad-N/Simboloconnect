import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { UserPlus, Upload, Search, Download, X, Trash2, CheckCircle, Send } from 'lucide-react';
import Papa from 'papaparse';
import BroadcastModal from '../components/BroadcastModal';

const Contacts = () => {
    const [contacts, setContacts] = useState([]);
    const [pagination, setPagination] = useState(null);
    const [page, setPage] = useState(1);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [showAddForm, setShowAddForm] = useState(false);
    const [existingGroups, setExistingGroups] = useState([]);
    
    // Add Manual State
    const [formData, setFormData] = useState({ name: '', phone: '' });
    const [selectedGroups, setSelectedGroups] = useState([]);
    const [newGroupInput, setNewGroupInput] = useState('');

    // CSV Import Modal State
    const [showImportModal, setShowImportModal] = useState(false);
    const [tempParsedContacts, setTempParsedContacts] = useState([]);
    const [importSelectedGroups, setImportSelectedGroups] = useState([]);
    const [importNewGroupInput, setImportNewGroupInput] = useState('');
    const [importing, setImporting] = useState(false);

    // Bulk Management State
    const [selectedContactIds, setSelectedContactIds] = useState([]);
    
    // Broadcast Modal State
    const [showBroadcastModal, setShowBroadcastModal] = useState(false);
    const [broadcastTargetContacts, setBroadcastTargetContacts] = useState([]);
    const [broadcastTargetTags, setBroadcastTargetTags] = useState([]);

    const fileInputRef = useRef(null);

    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedSearch(searchTerm);
            setPage(1); // Reset page on new search
        }, 500);
        return () => clearTimeout(handler);
    }, [searchTerm]);

    const [activeTab, setActiveTab] = useState('contacts'); // 'contacts' | 'groups'
    const [filterByGroup, setFilterByGroup] = useState(null);

    const fetchContacts = async () => {
        setIsLoading(true);
        try {
            const params = { page, limit: 50 };
            if (debouncedSearch) params.search = debouncedSearch;
            if (filterByGroup) params.tags = filterByGroup;
            
            const response = await axios.get(`${import.meta.env.VITE_API_URL}/api/contacts`, { params });
            if (response.data.data) {
                setContacts(response.data.data);
                setPagination(response.data.pagination);
            } else {
                setContacts(response.data);
                setPagination(null);
            }
            setSelectedContactIds([]);
        } catch (error) {
            console.error("Failed to fetch contacts", error);
        } finally {
            setIsLoading(false);
        }
    };

    const fetchGroups = async () => {
        try {
            const response = await axios.get(`${import.meta.env.VITE_API_URL}/api/contacts/groups`);
            setExistingGroups(response.data);
        } catch (error) {
            console.error("Failed to fetch groups", error);
        }
    };

    useEffect(() => {
        fetchContacts();
    }, [page, debouncedSearch, filterByGroup]);

    useEffect(() => {
        fetchGroups();
    }, []);

    const handleAddContact = async (e) => {
        e.preventDefault();
        try {
            let formattedPhone = formData.phone.trim();
            if (!formattedPhone.startsWith('+')) {
                formattedPhone = '+' + formattedPhone;
            }

            await axios.post(`${import.meta.env.VITE_API_URL}/api/contacts/add`, {
                name: formData.name,
                phone: formattedPhone,
                tags: selectedGroups
            });

            setFormData({ name: '', phone: '' });
            setSelectedGroups([]);
            setNewGroupInput('');
            setShowAddForm(false);
            fetchContacts();
            fetchGroups();

        } catch (error) {
            console.error("Error adding contact", error);
            alert("Failed to add contact: " + (error.response?.data?.error || error.message));
        }
    };

    const handleFileUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: (results) => {
                const parsedData = results.data;
                const fixedKeys = ['name', 'phone', 'phone number', 'group name', 'group', 'groups', 'tags'];

                const mappedContacts = parsedData.map(row => {
                    let phoneNum = (row.Phone || row.phone || row['Phone Number'] || '').toString().trim();
                    if (phoneNum && !phoneNum.startsWith('+')) {
                        phoneNum = '+' + phoneNum;
                    }

                    // Extract all columns other than name, phone, group name to customFields
                    const customFields = {};
                    Object.keys(row).forEach(key => {
                        const val = row[key];
                        const cleanKey = key.trim();
                        const lowerKey = cleanKey.toLowerCase();
                        if (cleanKey && !fixedKeys.includes(lowerKey) && val !== undefined && val !== null) {
                            customFields[cleanKey] = val.toString().trim();
                        }
                    });

                    return {
                        name: row.Name || row.name || 'Unknown',
                        phone: phoneNum,
                        tags: row['Group Name'] || row.Group || row.Groups || row.Tags || row.tags || '',
                        customFields
                    };
                }).filter(c => c.phone);

                if (mappedContacts.length === 0) {
                    alert("No valid contacts found in CSV. Ensure 'Phone' column exists.");
                    return;
                }

                setTempParsedContacts(mappedContacts);
                setImportSelectedGroups([]);
                setImportNewGroupInput('');
                setShowImportModal(true);
            },
            error: (error) => {
                console.error("CSV Parsing Error:", error);
                alert("Failed to parse CSV file.");
            }
        });

        // Reset file input so same file can be clicked again
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const confirmImport = async () => {
        setImporting(true);
        try {
            // Safely capture any text they typed but forgot to hit enter on
            const finalGroups = [...importSelectedGroups];
            if (importNewGroupInput.trim() && !finalGroups.includes(importNewGroupInput.trim())) {
                finalGroups.push(importNewGroupInput.trim());
            }

            // Apply the globally selected groups in the modal to ALL parsed contacts
            const enhancedContacts = tempParsedContacts.map(c => {
                let parsedRowTags = typeof c.tags === 'string' ? c.tags.split(',').map(t => t.trim()).filter(t => t) : [];
                return {
                    ...c,
                    tags: Array.from(new Set([...parsedRowTags, ...finalGroups]))
                };
            });

            const res = await axios.post(`${import.meta.env.VITE_API_URL}/api/contacts/bulk`, {
                contacts: enhancedContacts
            });
            alert(res.data.message || `Successfully imported contacts.`);
            setShowImportModal(false);
            fetchContacts();
            fetchGroups();
        } catch (error) {
            console.error("Bulk import failed", error);
            alert("Bulk import failed: " + (error.response?.data?.error || error.message));
        } finally {
            setImporting(false);
        }
    };

    const downloadSampleCSV = () => {
        const csvContent = "data:text/csv;charset=utf-8,Name,Phone,Group Name\nJohn Doe,919876543210,VIP\nJane Smith,919087654321,Lead";
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", "sample_contacts.csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleExport = async () => {
        try {
            const response = await axios.get(`${import.meta.env.VITE_API_URL}/api/contacts/export`, {
                responseType: 'blob'
            });
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', 'contacts_export.csv');
            document.body.appendChild(link);
            link.click();
            link.parentNode.removeChild(link);
        } catch (error) {
            console.error("Export failed", error);
            alert("Export failed.");
        }
    };

    const handleDeleteContact = async (id) => {
        if (!window.confirm("Are you sure you want to delete this contact?")) return;

        try {
            await axios.delete(`${import.meta.env.VITE_API_URL}/api/contacts/${id}`);
            setContacts(contacts.filter(c => c.id !== id));
        } catch (error) {
            console.error("Error deleting contact", error);
            alert("Failed to delete contact: " + (error.response?.data?.error || error.message));
        }
    };

    const handleBulkDelete = async () => {
        if (!window.confirm(`Are you sure you want to delete ${selectedContactIds.length} contacts?`)) return;

        try {
            await axios.post(`${import.meta.env.VITE_API_URL}/api/contacts/bulk-delete`, {
                contactIds: selectedContactIds
            });
            fetchContacts();
        } catch (error) {
            console.error("Bulk delete failed", error);
            alert("Bulk delete failed: " + (error.response?.data?.error || error.message));
        }
    };

    const handleDeleteGroup = async (groupName) => {
        if (!window.confirm(`Are you sure you want to delete group "${groupName}"? This will remove the tag from all contacts but won't delete the contacts themselves.`)) return;

        try {
            await axios.delete(`${import.meta.env.VITE_API_URL}/api/contacts/groups/${encodeURIComponent(groupName)}`);
            fetchContacts();
            fetchGroups();
        } catch (error) {
            console.error("Error deleting group", error);
            alert("Failed to delete group: " + (error.response?.data?.error || error.message));
        }
    };

    const handleOpenBroadcastModalForSelected = () => {
        if (selectedContactIds.length === 0) return;
        const selectedPhones = contacts.filter(c => selectedContactIds.includes(c.id)).map(c => c.phone);
        setBroadcastTargetContacts(selectedPhones);
        setBroadcastTargetTags([]);
        setShowBroadcastModal(true);
    };

    const handleOpenBroadcastModalForGroup = (groupName) => {
        setBroadcastTargetContacts([]);
        setBroadcastTargetTags([groupName]);
        setShowBroadcastModal(true);
    };

    // Tab state (moved up for dependency)
    // const [activeTab, setActiveTab] = useState('contacts');
    // const [filterByGroup, setFilterByGroup] = useState(null);

    const filteredContacts = contacts; // backend filtering applied

    const dynamicKeys = Array.from(new Set(
        contacts.flatMap(c => {
            if (!c.customFields) return [];
            try {
                const fields = typeof c.customFields === 'string' ? JSON.parse(c.customFields) : c.customFields;
                return Object.keys(fields);
            } catch (_) {
                return [];
            }
        })
    )).sort();

    // Compute Groups Metadata for the Groups Tab
    const groupsData = existingGroups.map(groupName => {
        const count = contacts.filter(c => c.tags && c.tags.includes(groupName)).length;
        return { name: groupName, count };
    });

    const toggleSelectAll = (e) => {
        if (e.target.checked) {
            setSelectedContactIds(filteredContacts.map(c => c.id));
        } else {
            setSelectedContactIds([]);
        }
    };

    const toggleSelectContact = (id) => {
        setSelectedContactIds(prev => 
            prev.includes(id) ? prev.filter(cId => cId !== id) : [...prev, id]
        );
    };

    return (
        <div className="max-w-6xl mx-auto space-y-6">
            <div className="flex justify-between items-center sm:flex-row flex-col gap-4">
                <h1 className="text-3xl font-bold font-display text-white">Contacts Manager</h1>
                <div className="flex flex-wrap gap-3">
                    {activeTab === 'contacts' && selectedContactIds.length > 0 && (
                        <>
                            <button
                                onClick={handleOpenBroadcastModalForSelected}
                                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-brand-500 text-white hover:bg-brand-600 font-medium transition-colors border border-brand-500 shadow-lg shadow-brand-500/25"
                            >
                                <Send size={16} /> Broadcast ({selectedContactIds.length})
                            </button>
                            <button
                                onClick={handleBulkDelete}
                                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-500/20 text-red-400 hover:bg-red-500/30 font-medium transition-colors border border-red-500/30"
                            >
                                <Trash2 size={16} /> Delete ({selectedContactIds.length})
                            </button>
                        </>
                    )}

                    <button
                        onClick={handleExport}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-surface-800 text-surface-300 hover:text-white transition-colors"
                        title="Export Contacts as CSV"
                    >
                        <Download size={18} /> Export
                    </button>
                    <button
                        onClick={downloadSampleCSV}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-surface-800 text-surface-300 hover:text-white transition-colors text-sm"
                        title="Download sample CSV format"
                    >
                        Sample CSV
                    </button>

                    <input
                        type="file"
                        accept=".csv"
                        className="hidden"
                        ref={fileInputRef}
                        onChange={handleFileUpload}
                    />
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-surface-800 text-white hover:bg-surface-700 transition-colors"
                    >
                        <Upload size={18} /> Import CSV
                    </button>

                    <button
                        onClick={() => setShowAddForm(!showAddForm)}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-brand-500 text-white hover:bg-brand-600 transition-colors shadow-lg shadow-brand-500/25"
                    >
                        <UserPlus size={18} /> Add Manual
                    </button>
                </div>
            </div>

            {/* CSV Import Target Group Modal */}
            {showImportModal && (
                <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-surface-800 rounded-2xl border border-surface-700 w-full max-w-lg p-6 shadow-2xl">
                        <div className="flex justify-between items-center mb-5">
                            <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                <CheckCircle className="text-green-400" size={24}/> Setup Broadcast Groups
                            </h2>
                            <button onClick={() => setShowImportModal(false)} className="text-surface-400 hover:text-white">
                                <X size={20} />
                            </button>
                        </div>
                        
                        <p className="text-surface-300 mb-6 text-sm">
                            We found <strong className="text-white">{tempParsedContacts.length} valid contacts</strong> in your uploaded CSV. Please assign exactly which <strong>existing</strong> or <strong>new</strong> groups these numbers should be inserted into.
                        </p>

                        <div className="mb-6">
                            <label className="block text-sm text-surface-400 mb-2">Assign to Groups (Type new and press Enter)</label>
                            <div className="bg-surface-900 rounded-xl p-3 min-h-[56px] border border-surface-700 focus-within:ring-1 focus-within:ring-brand-500">
                                <div className="flex flex-wrap gap-2 mb-2">
                                    {importSelectedGroups.map(grp => (
                                        <div key={grp} className="bg-brand-500/20 text-brand-400 px-3 py-1.5 flex items-center gap-2 rounded-lg font-medium text-sm">
                                            {grp}
                                            <button type="button" onClick={() => setImportSelectedGroups(importSelectedGroups.filter(g => g !== grp))} className="hover:text-red-400">
                                                <X size={14} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="text"
                                        value={importNewGroupInput}
                                        onChange={e => setImportNewGroupInput(e.target.value)}
                                        onKeyDown={e => {
                                            if (e.key === 'Enter') {
                                                e.preventDefault();
                                                const val = importNewGroupInput.trim();
                                                if (val && !importSelectedGroups.includes(val)) {
                                                    setImportSelectedGroups([...importSelectedGroups, val]);
                                                    setImportNewGroupInput('');
                                                }
                                            }
                                        }}
                                        placeholder="Type new Group & press Enter..."
                                        className="flex-1 bg-transparent border-none text-white outline-none px-2"
                                    />
                                    {existingGroups.filter(g => !importSelectedGroups.includes(g)).length > 0 && (
                                        <select
                                            className="bg-surface-800 border border-surface-600 text-surface-200 text-sm rounded-lg py-1.5 px-3 outline-none cursor-pointer"
                                            onChange={(e) => {
                                                if (e.target.value) {
                                                    setImportSelectedGroups([...importSelectedGroups, e.target.value]);
                                                    e.target.value = "";
                                                }
                                            }}
                                        >
                                            <option value="">Select Existing...</option>
                                            {existingGroups.filter(g => !importSelectedGroups.includes(g)).map(g => (
                                                <option key={g} value={g}>{g}</option>
                                            ))}
                                        </select>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="flex gap-3">
                            <button onClick={() => setShowImportModal(false)} className="btn-secondary flex-1">Cancel</button>
                            <button onClick={confirmImport} disabled={importing} className="btn-primary flex-1">
                                {importing ? 'Importing...' : `Confirm Import`}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {showAddForm && (
                <div className="glass-panel p-6 rounded-2xl border border-surface-700 bg-surface-900/50">
                    <h2 className="text-xl font-semibold text-white mb-4">Add New Contact</h2>
                    <form onSubmit={handleAddContact} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-start">
                        <div>
                            <label className="block text-sm text-surface-400 mb-1">Name</label>
                            <input
                                type="text"
                                required
                                value={formData.name}
                                onChange={e => setFormData({ ...formData, name: e.target.value })}
                                placeholder="John Doe"
                                className="w-full bg-surface-800 border-none rounded-xl px-4 py-3 text-white focus:ring-1 focus:ring-brand-500 outline-none"
                            />
                        </div>
                        <div>
                            <label className="block text-sm text-surface-400 mb-1">Phone Number</label>
                            <input
                                type="text"
                                required
                                value={formData.phone}
                                onChange={e => {
                                    let val = e.target.value;
                                    val = val.replace(/[^\d+]/g, '');
                                    if (!val) {
                                        setFormData({ ...formData, phone: '' });
                                        return;
                                    }
                                    if (val.length > 0 && !val.startsWith('+')) {
                                        val = '+' + val;
                                    }
                                    val = '+' + val.replace(/\+/g, '');
                                    setFormData({ ...formData, phone: val });
                                }}
                                placeholder="+919876543210"
                                className="w-full bg-surface-800 border-none rounded-xl px-4 py-3 text-white focus:ring-1 focus:ring-brand-500 outline-none"
                            />
                        </div>
                        <div className="md:col-span-2">
                            <label className="block text-sm text-surface-400 mb-1">Select or Create Groups</label>
                            <div className="bg-surface-800 rounded-xl p-2 min-h-[48px] border border-surface-700 focus-within:ring-1 focus-within:ring-brand-500">
                                <div className="flex flex-wrap gap-2 mb-1">
                                    {selectedGroups.map(grp => (
                                        <div key={grp} className="bg-brand-500/20 text-brand-400 px-2 py-1 flex items-center gap-1 rounded font-medium text-sm">
                                            {grp}
                                            <button type="button" onClick={() => setSelectedGroups(selectedGroups.filter(g => g !== grp))} className="hover:text-red-400">
                                                <X size={14} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="text"
                                        value={newGroupInput}
                                        onChange={e => setNewGroupInput(e.target.value)}
                                        onKeyDown={e => {
                                            if (e.key === 'Enter') {
                                                e.preventDefault();
                                                const val = newGroupInput.trim();
                                                if (val && !selectedGroups.includes(val)) {
                                                    setSelectedGroups([...selectedGroups, val]);
                                                    setNewGroupInput('');
                                                }
                                            }
                                        }}
                                        placeholder="Type new & press Enter..."
                                        className="flex-1 bg-transparent border-none text-white text-sm outline-none px-2"
                                    />
                                    {existingGroups.filter(g => !selectedGroups.includes(g)).length > 0 && (
                                        <select
                                            className="bg-surface-900 border border-surface-700 text-surface-300 text-sm rounded py-1 px-2 outline-none max-w-[150px] cursor-pointer"
                                            onChange={(e) => {
                                                if (e.target.value) {
                                                    setSelectedGroups([...selectedGroups, e.target.value]);
                                                    e.target.value = "";
                                                }
                                            }}
                                        >
                                            <option value="">Select existing...</option>
                                            {existingGroups.filter(g => !selectedGroups.includes(g)).map(g => (
                                                <option key={g} value={g}>{g}</option>
                                            ))}
                                        </select>
                                    )}
                                </div>
                            </div>
                        </div>
                        <div className="md:col-start-4 flex gap-2 pt-2">
                            <button
                                type="submit"
                                className="w-full py-3 rounded-xl bg-brand-500 text-white hover:bg-brand-600 transition-colors font-medium"
                            >
                                Save Contact
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* TABS NAVIGATION */}
            <div className="flex gap-4 border-b border-surface-700 pb-1">
                <button
                    onClick={() => { setActiveTab('contacts'); setFilterByGroup(null); }}
                    className={`font-semibold pb-3 px-2 border-b-2 transition-colors ${activeTab === 'contacts' && !filterByGroup ? 'border-brand-500 text-brand-400' : 'border-transparent text-surface-400 hover:text-white'}`}
                >
                    All Contacts
                </button>
                <button
                    onClick={() => { setActiveTab('groups'); setFilterByGroup(null); }}
                    className={`font-semibold pb-3 px-2 border-b-2 transition-colors ${activeTab === 'groups' ? 'border-brand-500 text-brand-400' : 'border-transparent text-surface-400 hover:text-white'}`}
                >
                    Groups
                </button>
                {filterByGroup && (
                    <button
                        className="font-semibold pb-3 px-2 border-b-2 border-brand-500 text-brand-400 flex items-center gap-2"
                    >
                        Group: {filterByGroup}
                        <X size={16} className="cursor-pointer hover:text-white" onClick={(e) => { e.stopPropagation(); setFilterByGroup(null); }} />
                    </button>
                )}
            </div>

            <div className="glass-panel rounded-2xl border border-surface-700 overflow-hidden flex flex-col h-[calc(100vh-18rem)] bg-surface-900/40">
                {activeTab === 'contacts' ? (
                    <>
                        <div className="p-4 border-b border-surface-700 flex items-center bg-surface-800/80">
                            <div className="relative w-full max-w-md">
                                <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-white0" />
                                <input
                                    type="text"
                                    placeholder="Search contacts by name or phone..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full bg-surface-900 border border-surface-600 rounded-xl pl-10 pr-4 py-2.5 text-white focus:ring-1 focus:ring-brand-500 outline-none placeholder:text-white0"
                                />
                            </div>
                        </div>

                        <div className="flex-1 overflow-auto">
                            <table className="w-full text-left border-collapse">
                                <thead className="sticky top-0 bg-surface-800 backdrop-blur-md z-10 border-b border-surface-700/80 shadow-sm">
                                    <tr>
                                        <th className="p-4 w-12 text-center">
                                            <input 
                                                type="checkbox" 
                                                className="w-4 h-4 rounded border-surface-600 bg-surface-700 checked:bg-brand-500 checked:border-brand-500 cursor-pointer focus:ring-brand-500 focus:ring-offset-surface-800"
                                                checked={filteredContacts.length > 0 && selectedContactIds.length === filteredContacts.length}
                                                onChange={toggleSelectAll}
                                                disabled={isLoading || filteredContacts.length === 0}
                                            />
                                        </th>
                                        <th className="p-4 text-sm font-semibold text-surface-300">Name</th>
                                        <th className="p-4 text-sm font-semibold text-surface-300">Phone</th>
                                        <th className="p-4 text-sm font-semibold text-surface-300">Groups</th>
                                        {dynamicKeys.map(key => (
                                            <th key={key} className="p-4 text-sm font-semibold text-surface-300">{key}</th>
                                        ))}
                                        <th className="p-4 text-sm font-semibold text-surface-300">Added Date</th>
                                        <th className="p-4 text-sm font-semibold text-surface-300 w-16">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-surface-700/50">
                                    {isLoading ? (
                                        <tr><td colSpan={6 + dynamicKeys.length} className="text-center p-8 text-white0 font-medium">Loading contacts...</td></tr>
                                    ) : filteredContacts.length === 0 ? (
                                        <tr>
                                            <td colSpan={6 + dynamicKeys.length} className="text-center p-12 text-white0">
                                                <div className="flex flex-col items-center justify-center py-6">
                                                    <UserPlus size={48} className="text-surface-600 mb-4" />
                                                    <p className="text-lg font-medium text-white mb-2">No contacts found</p>
                                                    <p className="max-w-md text-sm">Add contacts manually or import a CSV file to heavily populate your audiences.</p>
                                                </div>
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredContacts.map((contact) => (
                                            <tr key={contact.id} className={`hover:bg-surface-700/40 transition-colors ${selectedContactIds.includes(contact.id) ? 'bg-surface-700/60' : ''}`}>
                                                <td className="p-4 text-center">
                                                    <input 
                                                        type="checkbox" 
                                                        className="w-4 h-4 rounded border-surface-600 bg-surface-800 checked:bg-brand-500 checked:border-brand-500 cursor-pointer focus:ring-brand-500 focus:ring-offset-surface-900"
                                                        checked={selectedContactIds.includes(contact.id)}
                                                        onChange={() => toggleSelectContact(contact.id)}
                                                    />
                                                </td>
                                                <td className="p-4 font-semibold text-white">{contact.name}</td>
                                                <td className="p-4 text-surface-300 font-mono text-sm tracking-wide">
                                                    {contact.phone?.startsWith('+') ? contact.phone : `+${contact.phone}`}
                                                </td>
                                                <td className="p-4">
                                                    <div className="flex flex-wrap gap-1.5">
                                                        {contact.tags.map((tag, i) => (
                                                            <span key={i} className="px-2.5 py-1 rounded bg-brand-500/10 border border-brand-500/20 text-xs font-medium text-brand-300">
                                                                {tag}
                                                            </span>
                                                        ))}
                                                        {(!contact.tags || contact.tags.length === 0) && <span className="text-white0 text-sm italic">Unassigned</span>}
                                                    </div>
                                                </td>
                                                {dynamicKeys.map(key => {
                                                    const fields = typeof contact.customFields === 'string' ? JSON.parse(contact.customFields) : (contact.customFields || {});
                                                    return (
                                                        <td key={key} className="p-4 text-sm text-surface-300">
                                                            {fields[key] !== undefined && fields[key] !== null ? String(fields[key]) : '-'}
                                                        </td>
                                                    );
                                                })}
                                                <td className="p-4 text-sm text-surface-400">
                                                    {new Date(contact.createdAt).toLocaleDateString()}
                                                </td>
                                                <td className="p-4">
                                                    <button
                                                        onClick={() => handleDeleteContact(contact.id)}
                                                        className="p-2 rounded-lg text-surface-400 hover:text-red-400 hover:bg-red-500/20 transition-colors"
                                                        title="Delete Contact"
                                                    >
                                                        <Trash2 size={18} />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                        
                        {/* Pagination Controls */}
                        {pagination && pagination.totalPages > 1 && (
                            <div className="p-4 border-t border-surface-700 bg-surface-800/80 flex items-center justify-between">
                                <span className="text-sm text-surface-400">
                                    Page {pagination.page} of {pagination.totalPages} ({pagination.total} total)
                                </span>
                                <div className="flex gap-2">
                                    <button 
                                        disabled={pagination.page <= 1} 
                                        onClick={() => setPage(pagination.page - 1)}
                                        className="px-3 py-1.5 rounded-lg bg-surface-700 text-white disabled:opacity-50 text-sm font-medium"
                                    >
                                        Previous
                                    </button>
                                    <button 
                                        disabled={pagination.page >= pagination.totalPages} 
                                        onClick={() => setPage(pagination.page + 1)}
                                        className="px-3 py-1.5 rounded-lg bg-surface-700 text-white disabled:opacity-50 text-sm font-medium"
                                    >
                                        Next
                                    </button>
                                </div>
                            </div>
                        )}
                    </>
                ) : (
                    // GROUPS TAB VIEW
                    <div className="p-6 h-full overflow-auto grid grid-cols-1 md:grid-cols-3 gap-4 auto-rows-max">
                        {groupsData.length === 0 ? (
                            <div className="col-span-full flex flex-col items-center justify-center p-12 text-white0">
                                <p className="text-lg font-medium text-white mb-2">No Groups Created Yet</p>
                                <p>Groups are automatically generated when you assign tags to contacts.</p>
                            </div>
                        ) : (
                            groupsData.map((group, idx) => (
                                <div key={idx} onClick={() => { setFilterByGroup(group.name); setActiveTab('contacts'); }} className="bg-surface-800/80 border border-surface-700 hover:border-brand-500/50 p-6 rounded-2xl cursor-pointer transition-all hover:-translate-y-1 shadow-lg shadow-black/20 group">
                                    <div className="flex justify-between items-start mb-2">
                                        <h3 className="text-white font-bold text-lg group-hover:text-brand-400 transition-colors">{group.name}</h3>
                                        <div className="bg-brand-500/10 text-brand-400 font-mono px-3 py-1 rounded-full text-xs font-bold border border-brand-500/20">
                                            {group.count} Contacts
                                        </div>
                                    </div>
                                    <div className="flex justify-between items-center mt-4 gap-2">
                                        <p className="text-surface-400 text-sm text-brand-500 group-hover:underline">View all contacts &rarr;</p>
                                        <div className="flex gap-2">
                                            <button 
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleOpenBroadcastModalForGroup(group.name);
                                                }}
                                                className="bg-brand-500 text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-brand-600 transition-colors flex items-center gap-1.5"
                                            >
                                                <Send size={14} /> Broadcast
                                            </button>
                                            <button 
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleDeleteGroup(group.name);
                                                }}
                                                className="bg-red-500/20 text-red-400 border border-red-500/30 px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-red-500/30 transition-colors flex items-center gap-1"
                                                title="Delete Group"
                                            >
                                                <Trash2 size={14} /> Delete
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                )}
            </div>

            <BroadcastModal 
                isOpen={showBroadcastModal}
                onClose={() => setShowBroadcastModal(false)}
                targetContacts={broadcastTargetContacts}
                targetTags={broadcastTargetTags}
                onCampaignCreated={() => {
                    setSelectedContactIds([]);
                }}
            />
        </div>
    );
};

export default Contacts;
