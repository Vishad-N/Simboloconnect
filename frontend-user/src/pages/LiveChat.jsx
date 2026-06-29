import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { Send, Mic, Square, User as UserIcon, Clock, Check, CheckCheck, Paperclip, X, Trash2, Download, ArrowLeft, Info, ListChecks, Bot, BotOff, Save, MessageSquare, Zap, CheckCircle, AlertCircle, RotateCcw, Bell, Image, FileText, Zap as ZapIcon, Upload } from 'lucide-react';
import axios from 'axios';
import { io } from 'socket.io-client';

const LiveChat = () => {
    const [contacts, setContacts] = useState([]);
    const [contactsLoading, setContactsLoading] = useState(true);
    const [selectedContact, setSelectedContact] = useState(null);
    const [isRecording, setIsRecording] = useState(false);
    const [recordingTime, setRecordingTime] = useState(0);
    const mediaRecorderRef = useRef(null);
    const audioChunksRef = useRef([]);
    const recordingIntervalRef = useRef(null);
    const shouldSendRecordRef = useRef(false);
    const canvasRef = useRef(null);
    const audioContextRef = useRef(null);
    const analyserRef = useRef(null);
    const animationFrameRef = useRef(null);
    const [messages, setMessages] = useState([]);
    const [inputText, setInputText] = useState('');
    const [socket, setSocket] = useState(null);
    const messagesEndRef = useRef(null);
    const selectedContactRef = useRef(null);
    const inputRef = useRef(null);
    const fileInputRef = useRef(null);
    const [selectedFile, setSelectedFile] = useState(null);
    const [filePreview, setFilePreview] = useState(null);
    const [isDragging, setIsDragging] = useState(false);
    const [lightboxImage, setLightboxImage] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [readFilter, setReadFilter] = useState('all');

    // Bulk & CRM State
    const [selectedContacts, setSelectedContacts] = useState([]);
    const [isBulkMode, setIsBulkMode] = useState(false);
    const [showRightDrawer, setShowRightDrawer] = useState(false);
    const [drawerTab, setDrawerTab] = useState('info'); // 'info' | 'comments' | 'actions'
    const [teamMembers, setTeamMembers] = useState([]);
    const [crmName, setCrmName] = useState('');
    const [crmAssignee, setCrmAssignee] = useState('');
    const [crmNotes, setCrmNotes] = useState('');
    const [crmStatus, setCrmStatus] = useState('OPEN');
    const [comments, setComments] = useState([]);
    const [newComment, setNewComment] = useState('');
    const [postingComment, setPostingComment] = useState(false);
    const [toast, setToast] = useState(null); // { message, type }
    const toastTimer = useRef(null);

    // Template quick-send state
    const [showTemplatePanel, setShowTemplatePanel] = useState(false);
    const [templates, setTemplates] = useState([]);
    const [templateSearch, setTemplateSearch] = useState('');

    // Emoji picker state — MUST be at component level (not inside render/IIFE)
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const [emojiCat, setEmojiCat] = useState(0);
    const emojiPickerRef = useRef(null);
    const templatePanelRef = useRef(null);

    // Close emoji picker when clicking outside
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (emojiPickerRef.current && !emojiPickerRef.current.contains(e.target)) {
                setShowEmojiPicker(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Keep the ref visually synced with state to use inside socket callbacks
    useEffect(() => {
        selectedContactRef.current = selectedContact;
    }, [selectedContact]);

    // Use useLayoutEffect to scroll BEFORE browser paints the screen
    useLayoutEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "auto" });
    }, [messages]); // Trigger instantly on any message change

    useEffect(() => {
        if (selectedContact && inputRef.current) {
            // Only auto-focus on desktop to prevent mobile keyboard from popping up unexpectedly
            if (window.innerWidth >= 768) {
                inputRef.current.focus();
            }
        }
    }, [selectedContact]);

    useEffect(() => {
        // Initialize Socket.io specifically for the chat component
        const newSocket = io(import.meta.env.VITE_API_URL);

        newSocket.on('connect', () => {
            const tenantId = localStorage.getItem('tenantId') || 'test-user-id';
            newSocket.emit('join_tenant', tenantId);
        });

        // Listen for new incoming messages
        newSocket.on('new_message', (log) => {
            const currentSelected = selectedContactRef.current;
            const isActiveChat = currentSelected && currentSelected.recipient === log.recipient;

            if (isActiveChat) {
                setMessages(prevMessages => {
                    // Check if we already have this message by ID
                    const idExists = prevMessages.some(m => m.messageId === log.messageId || m.id === log.messageId);

                    // Check if we have a pending optimistic message with same content within last 5 seconds
                    const contentMatch = prevMessages.some(m =>
                        m.status === 'PENDING' &&
                        m.direction === 'OUTBOUND' &&
                        log.direction === 'OUTBOUND' &&
                        m.content?.text === log.content?.text &&
                        (new Date(log.timestamp) - new Date(m.timestamp) < 5000)
                    );

                    if (idExists) return prevMessages; // Already exists exactly

                    if (contentMatch && log.direction === 'OUTBOUND') {
                        // Replace pending message with real confirmed message
                        return prevMessages.map(m =>
                            (m.status === 'PENDING' && m.content?.text === log.content?.text)
                                ? log
                                : m
                        );
                    }

                    return [...prevMessages, log];
                });
            }

            // Update contacts list logic remains same
            setContacts(prevContacts => {
                const existingIndex = prevContacts.findIndex(c => c.recipient === log.recipient);
                let newContacts = [...prevContacts];
                let contactData = { ...log };

                if (existingIndex >= 0) {
                    const existing = newContacts[existingIndex];
                    let unreadCount = isActiveChat ? 0 : (log.direction === 'INBOUND' ? (existing.unreadCount || 0) + 1 : (existing.unreadCount || 0));
                    contactData = { ...existing, ...log, unreadCount };
                    newContacts.splice(existingIndex, 1);
                } else {
                    if (log.direction === 'INBOUND' && !isActiveChat) {
                        contactData.unreadCount = 1;
                    } else {
                        contactData.unreadCount = 0;
                    }
                }
                newContacts.unshift(contactData);
                return newContacts;
            });
        });

        // Listen for message status updates (e.g., SENT -> DELIVERED -> READ)
        newSocket.on('message_status_update', (data) => {
            setMessages(prevMessages =>
                prevMessages.map(msg =>
                    msg.messageId === data.messageId ? { ...msg, status: data.status } : msg
                )
            );
        });

        // Listen for new real-time comments
        newSocket.on('new_comment', ({ recipient, comment }) => {
            if (selectedContactRef.current?.recipient === recipient) {
                setComments(prev => [...prev, comment]);
            }
        });

        // Listen for inbound messages and show toast
        newSocket.on('new_message', (log) => {
            if (log.direction === 'INBOUND') {
                const preview = log.content?.text || log.content?.caption || '[Media]';
                showToast(`💬 New message: ${String(preview).substring(0, 40)}`, 'info');
            }
        });

        setSocket(newSocket);

        // Fetch initial contacts list
        fetchContacts();

        // Fetch Team Members for CRM Assignee
        const fetchTeam = async () => {
            try {
                const res = await axios.get(`${import.meta.env.VITE_API_URL}/api/staff`);
                setTeamMembers(res.data);
            } catch(e) {}
        };
        fetchTeam();

        // Fetch approved templates
        const fetchTemplates = async () => {
            try {
                const res = await axios.get(`${import.meta.env.VITE_API_URL}/api/templates`);
                setTemplates((res.data || []).filter(t => t.status === 'APPROVED' || t.status === 'approved'));
            } catch (e) {}
        };
        fetchTemplates();

        return () => newSocket.disconnect();
    }, []);

    const showToast = (message, type = 'success') => {
        setToast({ message, type });
        if (toastTimer.current) clearTimeout(toastTimer.current);
        toastTimer.current = setTimeout(() => setToast(null), 4000);
    };

    const fetchContacts = async () => {
        try {
            const response = await axios.get(`${import.meta.env.VITE_API_URL}/api/chat/contacts`);
            setContacts(response.data || []);
        } catch (error) {
            console.error("Failed to fetch contacts", error);
        } finally {
            setContactsLoading(false);
        }
    };



    const handleFileSelect = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        if (file.size > 10 * 1024 * 1024) {
            alert("File size must be under 10MB.");
            return;
        }

        setSelectedFile(file);

        const reader = new FileReader();
        reader.onloadend = () => {
            setFilePreview(reader.result);
        };
        reader.readAsDataURL(file);
    };

    const removeFile = () => {
        setSelectedFile(null);
        setFilePreview(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleDragOver = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(true);
    };

    const handleDragLeave = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
    };

    const handleDrop = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            handleDragDropFile(e.dataTransfer.files[0]);
        }
    };

    const handleDragDropFile = (file) => {
        if (!file) return;
        if (file.size > 10 * 1024 * 1024) {
            alert("File size must be under 10MB.");
            return;
        }
        setSelectedFile(file);
        const reader = new FileReader();
        reader.onloadend = () => {
            setFilePreview(reader.result);
        };
        reader.readAsDataURL(file);
    };

    const formatPhone = (phone) => {
        if (!phone) return '';
        const phoneStr = phone.toString();
        return phoneStr.startsWith('+') ? phoneStr : '+' + phoneStr;
    };

    // Returns: "Name" or "+91XXXXXXXX" (never shows number twice)
    const formatContactName = (contact) => {
        const phone = formatPhone(contact.recipient || contact.phone || '');
        const name = contact.name;
        // If no name, or name equals the raw number (old bug), show just phone
        if (!name || name === contact.recipient || name === contact.phone) return phone;
        return name;
    };

    // Returns: "Name (+91XXXXXXXX)" or just "+91XXXXXXXX" if no name
    const formatContactLabel = (contact) => {
        const phone = formatPhone(contact.recipient || contact.phone || '');
        const rawPhone = (contact.recipient || contact.phone || '').toString().replace(/^\+/, '');
        const name = (contact.name || '').toString().trim();
        // If no name, or name IS the phone number (with or without +), just show phone
        if (!name || name === phone || name === rawPhone || name === '+' + rawPhone) return phone;
        return `${name} (${phone})`;
    };

    const loadChatHistory = async (contact) => {
        setSelectedContact(contact);
        setCrmName(contact.name || contact.recipient);
        setCrmAssignee(contact.assignedToId || '');
        setCrmNotes(contact.internalNotes || '');
        setCrmStatus(contact.status || 'OPEN');
        setComments([]);
        setMessages([]); // Instantly clear chat to show loading or empty state
        setNewComment('');
        setDrawerTab('info');

        // Optimistically reset unread count, maintain bot paused state
        setContacts(prevContacts => prevContacts.map(c =>
            c.recipient === contact.recipient ? { ...c, unreadCount: 0 } : c
        ));

        try {
            const [histRes, commentsRes] = await Promise.all([
                axios.get(`${import.meta.env.VITE_API_URL}/api/chat/${encodeURIComponent(contact.recipient)}`),
                axios.get(`${import.meta.env.VITE_API_URL}/api/chat/${encodeURIComponent(contact.recipient)}/comments`)
            ]);
            let fetchedMsgs = histRes.data || [];
            setMessages(fetchedMsgs);
            setComments(commentsRes.data);
        } catch (error) {
            console.error("Failed to load history", error);
        }
    };

    const handleDeleteChat = async () => {
        if (!selectedContact) return;

        const confirmDelete = window.confirm(`Are you sure you want to permanently delete the entire chat history with ${formatPhone(selectedContact.recipient)}? This cannot be undone.`);

        if (!confirmDelete) return;

        try {
            await axios.delete(`${import.meta.env.VITE_API_URL}/api/chat/${encodeURIComponent(selectedContact.recipient)}`);

            // clear from UI
            setMessages([]);
            setContacts(prevContacts => prevContacts.filter(c => c.recipient !== selectedContact.recipient));
            setSelectedContact(null);

        } catch (error) {
            console.error("Failed to delete chat", error);
            alert("Failed to delete chat history.");
        }
    };

    const handleSelectContact = (e, contact) => {
        e.stopPropagation();
        if (e.target.checked) {
            setSelectedContacts([...selectedContacts, contact.recipient]);
        } else {
            setSelectedContacts(selectedContacts.filter(id => id !== contact.recipient));
        }
    };

    const handleBulkDelete = async () => {
        if (!selectedContacts.length) return;
        if (!window.confirm(`Delete ${selectedContacts.length} chats permanently?`)) return;
        try {
            await axios.post(`${import.meta.env.VITE_API_URL}/api/chat/bulk-delete`, { recipients: selectedContacts });
            setContacts(prev => prev.filter(c => !selectedContacts.includes(c.recipient)));
            if (selectedContact && selectedContacts.includes(selectedContact.recipient)) setSelectedContact(null);
            setSelectedContacts([]);
            setIsBulkMode(false);
        } catch(e) {
            alert("Failed to bulk delete.");
        }
    };

    const handleBulkBot = async (enabled) => {
        if (!selectedContacts.length) return;
        try {
            await axios.post(`${import.meta.env.VITE_API_URL}/api/chat/bulk-bot`, { recipients: selectedContacts, enabled });
            setContacts(prev => prev.map(c => selectedContacts.includes(c.recipient) ? { ...c, botPaused: !enabled } : c));
            if (selectedContact && selectedContacts.includes(selectedContact.recipient)) {
                setSelectedContact({...selectedContact, botPaused: !enabled});
            }
            setSelectedContacts([]);
            setIsBulkMode(false);
        } catch(e) {
            alert("Failed to toggle bot status.");
        }
    };

    const saveCrmDetails = async () => {
        try {
            const res = await axios.put(`${import.meta.env.VITE_API_URL}/api/chat/${selectedContact.recipient}/crm`, {
                name: crmName,
                assignedToId: crmAssignee,
                internalNotes: crmNotes
            });
            const updatedContact = {
                ...selectedContact,
                name: crmName,
                assignedToId: crmAssignee,
                internalNotes: crmNotes
            };
            setSelectedContact(updatedContact);
            setContacts(prev => prev.map(c => c.recipient === updatedContact.recipient ? updatedContact : c));
            showToast('Details saved!', 'success');
        } catch (e) {
            showToast('Failed to save details.', 'error');
        }
    };

    const handleStatusChange = async (newStatus) => {
        setCrmStatus(newStatus);
        try {
            await axios.put(`${import.meta.env.VITE_API_URL}/api/chat/${selectedContact.recipient}/status`, { status: newStatus });
            const updatedContact = { ...selectedContact, status: newStatus };
            setSelectedContact(updatedContact);
            setContacts(prev => prev.map(c => c.recipient === updatedContact.recipient ? updatedContact : c));
            showToast(`Marked as ${newStatus}`, 'success');
        } catch (e) {
            showToast('Failed to update status.', 'error');
        }
    };

    const postComment = async () => {
        if (!newComment.trim() || !selectedContact) return;
        setPostingComment(true);
        try {
            const res = await axios.post(`${import.meta.env.VITE_API_URL}/api/chat/${selectedContact.recipient}/comments`, { text: newComment });
            setComments(prev => [...prev, res.data]);
            setNewComment('');
        } catch (e) {
            showToast('Failed to post comment.', 'error');
        } finally {
            setPostingComment(false);
        }
    };

    
    const formatRecordingTime = (seconds) => {
        const m = Math.floor(seconds / 60).toString().padStart(2, '0');
        const s = (seconds % 60).toString().padStart(2, '0');
        return `${m}:${s}`;
    };

    const drawWaveform = () => {
        if (!canvasRef.current || !analyserRef.current) return;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        const analyser = analyserRef.current;
        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        
        analyser.getByteTimeDomainData(dataArray);
        
        ctx.fillStyle = 'transparent';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#00a884';
        ctx.beginPath();
        
        const sliceWidth = canvas.width * 1.0 / bufferLength;
        let x = 0;
        
        for(let i = 0; i < bufferLength; i++) {
            const v = dataArray[i] / 128.0;
            const y = v * canvas.height / 2;
            
            if(i === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
            x += sliceWidth;
        }
        
        ctx.lineTo(canvas.width, canvas.height / 2);
        ctx.stroke();
        
        animationFrameRef.current = requestAnimationFrame(drawWaveform);
    };

    const startRecording = async () => {
        try {
            shouldSendRecordRef.current = false;
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            
            // Web Audio API for waveform
            const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            const analyser = audioCtx.createAnalyser();
            const source = audioCtx.createMediaStreamSource(stream);
            source.connect(analyser);
            analyser.fftSize = 256;
            audioContextRef.current = audioCtx;
            analyserRef.current = analyser;
            drawWaveform();

            const mediaRecorder = new MediaRecorder(stream);
            mediaRecorderRef.current = mediaRecorder;
            audioChunksRef.current = [];

            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    audioChunksRef.current.push(event.data);
                }
            };

            mediaRecorder.onstop = () => {
                let mimeType = mediaRecorder.mimeType || 'audio/webm';
                if (!mimeType) mimeType = 'audio/webm';
                
                const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
                const ext = mimeType.includes('mp4') ? 'mp4' : mimeType.includes('ogg') ? 'ogg' : 'webm';
                const file = new File([audioBlob], `VoiceNote_${Date.now()}.${ext}`, { type: mimeType });
                
                setSelectedFile(file);
                
                const reader = new FileReader();
                reader.onloadend = () => {
                    setFilePreview(reader.result);
                    // If send immediately
                    if (shouldSendRecordRef.current) {
                        // Create fake event to pass to handleSendMessage
                        const fakeEvent = { preventDefault: () => {} };
                        // Note: handleSendMessage uses state, but setFilePreview is async. 
                        // Instead of relying on state which hasn't updated yet, 
                        // we'll call a dedicated send logic or just manually invoke API.
                        setTimeout(() => {
                           // Actually, let's just submit the form. 
                           // But state might not be fully flushed.
                           // A cleaner way:
                           sendAudioDirectly(file, reader.result);
                        }, 50);
                    }
                };
                reader.readAsDataURL(file);
                
                stream.getTracks().forEach(track => track.stop());
                if (audioContextRef.current) {
                    audioContextRef.current.close();
                }
                if (animationFrameRef.current) {
                    cancelAnimationFrame(animationFrameRef.current);
                }
            };

            mediaRecorder.start();
            setIsRecording(true);
            setRecordingTime(0);
            recordingIntervalRef.current = setInterval(() => {
                setRecordingTime(prev => prev + 1);
            }, 1000);
        } catch (err) {
            console.error("Microphone access denied or error", err);
            alert("Could not access microphone. Please ensure permissions are granted.");
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
            clearInterval(recordingIntervalRef.current);
        }
    };

    const cancelRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
            clearInterval(recordingIntervalRef.current);
            setTimeout(() => {
                removeFile();
            }, 100);
        }
    };

    
    const sendAudioDirectly = async (fileObj, fileB64) => {
        if (!selectedContact) return;
        const tempId = Date.now().toString();
        const optimisticMsg = {
            id: tempId, recipient: selectedContact.recipient, direction: 'OUTBOUND', status: 'PENDING',
            content: { mediaUrl: fileB64, fileName: fileObj.name, type: 'audio' },
            timestamp: new Date().toISOString()
        };
        setMessages(prev => [...prev, optimisticMsg]);
        removeFile();
        
        try {
            const res = await axios.post(`${import.meta.env.VITE_API_URL}/api/chat/send`, {
                recipient: selectedContact.recipient,
                message: "",
                mediaBase64: fileB64,
                fileName: fileObj.name,
                mimeType: fileObj.type
            });
            setMessages(prev => prev.map(m => m.id === tempId ? res.data.data : m));
        } catch (error) {
            console.error("Failed to send audio", error);
            alert("Error sending audio: " + (error.response?.data?.error || error.message));
            setMessages(prev => prev.filter(m => m.id !== tempId));
        }
    };
    
    const handleSendWhileRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            shouldSendRecordRef.current = true;
            mediaRecorderRef.current.stop();
            setIsRecording(false);
            clearInterval(recordingIntervalRef.current);
        }
    };

    const handleSendMessage = async (e) => {
        e.preventDefault();
        if ((!inputText.trim() && !selectedFile) || !selectedContact) return;

        const outgoingMessage = inputText.trim();
        const currentSelectedFile = selectedFile;
        const currentFilePreview = filePreview;

        // Optimistically update UI
        const tempId = Date.now().toString();
        const optimisticMsg = {
            id: tempId,
            recipient: selectedContact.recipient,
            direction: 'OUTBOUND',
            status: 'PENDING',
            content: {
                text: outgoingMessage,
                mediaUrl: currentFilePreview,
                fileName: currentSelectedFile?.name,
                type: currentSelectedFile ? (currentSelectedFile.type.startsWith('image/') ? 'image' : 'document') : 'text'
            },
            timestamp: new Date().toISOString()
        };

        setMessages(prev => [...prev, optimisticMsg]);
        setInputText('');
        removeFile();

        try {
            const res = await axios.post(`${import.meta.env.VITE_API_URL}/api/chat/send`, {
                recipient: selectedContact.recipient,
                message: outgoingMessage,
                mediaBase64: currentFilePreview,
                fileName: currentSelectedFile?.name,
                mimeType: currentSelectedFile?.type
            });

            // Update the temp message with real data from server
            setMessages(prev => prev.map(m => m.id === tempId ? res.data.data : m));

        } catch (error) {
            console.error("Failed to send message", error);
            alert("Error sending message: " + (error.response?.data?.error || error.message));
            // Remove optimistic message on error
            setMessages(prev => prev.filter(m => m.id !== tempId));
        }
    };

    // Send an approved template to re-open 24hr window
    const handleSendTemplate = async (template) => {
        if (!selectedContact) return;
        setShowTemplatePanel(false);
        const token = localStorage.getItem('userToken');
        const tempId = Date.now().toString();
        const optimisticMsg = {
            id: tempId, recipient: selectedContact.recipient, direction: 'OUTBOUND', status: 'PENDING',
            content: { type: 'template', templateName: template.name },
            timestamp: new Date().toISOString()
        };
        setMessages(prev => [...prev, optimisticMsg]);
        try {
            const res = await axios.post(`${import.meta.env.VITE_API_URL}/api/chat/send-template`, {
                recipient: selectedContact.recipient,
                templateName: template.name,
                templateLanguage: template.language || 'en',
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setMessages(prev => prev.map(m => m.id === tempId ? (res.data?.data || { ...optimisticMsg, status: 'SENT' }) : m));
            showToast('Template sent!', 'success');
        } catch (error) {
            showToast('Failed to send template: ' + (error.response?.data?.error || error.message), 'error');
            setMessages(prev => prev.filter(m => m.id !== tempId));
        }
    };

    const formatTime = (isoString) => {
        if (!isoString) return '';
        const date = new Date(isoString);
        if (isNaN(date.getTime())) return '';
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    const renderStatusIcon = (status) => {
        if (!status) return null;
        switch (String(status).toUpperCase()) {
            case 'SENT': return <Check size={14} className="text-surface-400" />;
            case 'DELIVERED': return <CheckCheck size={14} className="text-surface-400" />;
            case 'READ': return <CheckCheck size={14} className="text-blue-400" />;
            default: return <Clock size={14} className="text-white0" />;
        }
    };

    return (
        // Break out of Layout's p-6/p-8 wrapper, fill exactly viewport minus header
        <div className="flex -m-6 md:-m-8 h-[calc(100vh-4rem)] overflow-hidden bg-surface-950 font-sans">
            {/* Toast Notification */}
            {toast && (
                <div className={`absolute top-4 right-4 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-xl text-sm font-medium transition-all animate-fade-in ${toast.type === 'error' ? 'bg-red-500/90 text-white' : toast.type === 'info' ? 'bg-blue-500/90 text-white' : 'bg-brand-500/90 text-white'}`}>
                    <Bell size={16} />
                    {toast.message}
                    <button onClick={() => setToast(null)} className="ml-1 opacity-70 hover:opacity-100"><X size={14} /></button>
                </div>
            )}
            {/* LEFT PANEL — fixed width, flex col, never shrinks */}
            <div className={`w-full md:w-[360px] flex-shrink-0 flex flex-col min-h-0 border-r border-white/5 bg-surface-900 ${selectedContact ? 'hidden md:flex' : 'flex'} z-20 shadow-[4px_0_24px_rgba(0,0,0,0.5)]`}>
                <div className="p-5 border-b border-white/5 hidden md:flex flex-col gap-4">
                    <div className="flex items-center justify-between">
                        <h2 className="text-xl font-bold font-display text-white">Chats</h2>
                        <button 
                            onClick={() => {
                                setIsBulkMode(!isBulkMode);
                                setSelectedContacts([]);
                            }} 
                            className={`p-2 rounded-lg transition-colors ${isBulkMode ? 'bg-brand-500 text-white' : 'text-surface-400 hover:bg-surface-800'}`}
                            title="Bulk Actions"
                        >
                            <ListChecks size={18} />
                        </button>
                    </div>
                    {/* Search Input */}
                        <input
                            type="text"
                            placeholder="Search name or number..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-surface-950/50 border border-white/5 rounded-[14px] px-4 py-2.5 text-sm text-surface-50 placeholder-surface-500 focus:border-brand-500/50 focus:bg-surface-950 outline-none transition-all duration-300 focus:shadow-[0_0_15px_rgba(0,217,165,0.1)]"
                        />
                    <div className="flex gap-2">
                        <button onClick={() => setReadFilter('all')} className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-all ${readFilter === 'all' ? 'bg-brand-500 text-white' : 'bg-surface-800 text-surface-400 hover:text-white'}`}>All</button>
                        <button onClick={() => setReadFilter('unread')} className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-all ${readFilter === 'unread' ? 'bg-brand-500 text-white' : 'bg-surface-800 text-surface-400 hover:text-white'}`}>Unread</button>
                        <button onClick={() => setReadFilter('read')} className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-all ${readFilter === 'read' ? 'bg-brand-500 text-white' : 'bg-surface-800 text-surface-400 hover:text-white'}`}>Read</button>
                    </div>
                </div>
                {/* Mobile Search Input */}
                <div className="p-3 border-b border-surface-700 md:hidden flex flex-col gap-3">
                    <input
                        type="text"
                        placeholder="Search name or number..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-surface-800 border-none rounded-xl px-4 py-2 text-sm text-surface-100 placeholder-surface-500 focus:ring-1 focus:ring-brand-500 outline-none"
                    />
                    <div className="flex gap-2">
                        <button onClick={() => setReadFilter('all')} className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-all ${readFilter === 'all' ? 'bg-brand-500 text-white' : 'bg-surface-800 text-surface-400 hover:text-white'}`}>All</button>
                        <button onClick={() => setReadFilter('unread')} className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-all ${readFilter === 'unread' ? 'bg-brand-500 text-white' : 'bg-surface-800 text-surface-400 hover:text-white'}`}>Unread</button>
                        <button onClick={() => setReadFilter('read')} className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-all ${readFilter === 'read' ? 'bg-brand-500 text-white' : 'bg-surface-800 text-surface-400 hover:text-white'}`}>Read</button>
                    </div>
                </div>
                {isBulkMode && (
                    <div className="p-2 bg-surface-800 border-b border-surface-700 flex items-center justify-between">
                        <div className="flex items-center gap-2 ml-1">
                            <input
                                type="checkbox"
                                title="Select All"
                                checked={contacts.length > 0 && selectedContacts.length === contacts.length}
                                onChange={(e) => {
                                    if (e.target.checked) {
                                        setSelectedContacts(contacts.map(c => c.recipient));
                                    } else {
                                        setSelectedContacts([]);
                                    }
                                }}
                                className="w-4 h-4 rounded border-surface-600 bg-surface-900 text-brand-500 focus:ring-brand-500 cursor-pointer"
                            />
                            <span className="text-xs text-surface-300">{selectedContacts.length > 0 ? `${selectedContacts.length} selected` : 'Select All'}</span>
                        </div>
                        <div className="flex gap-1">
                            <button onClick={() => handleBulkBot(true)} className="p-1.5 text-brand-400 hover:bg-surface-700 rounded" title="Enable Bot"><Bot size={16} /></button>
                            <button onClick={() => handleBulkBot(false)} className="p-1.5 text-surface-400 hover:bg-surface-700 rounded" title="Pause Bot"><BotOff size={16} /></button>
                            <button onClick={handleBulkDelete} className="p-1.5 text-red-400 hover:bg-surface-700 rounded" title="Delete Chats"><Trash2 size={16} /></button>
                        </div>
                    </div>
                )}
                {/* CONTACT LIST — flex-1 min-h-0 so it fills remaining space and scrolls */}
                <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden" style={{overscrollBehavior:'contain'}}>
                    {contactsLoading ? (
                        // Skeleton shimmer while loading
                        <div className="divide-y divide-white/5">
                            {[...Array(8)].map((_, i) => (
                                <div key={i} className="flex items-center gap-3 p-4 animate-pulse">
                                    <div className="w-11 h-11 rounded-full bg-surface-800 flex-shrink-0" />
                                    <div className="flex-1 space-y-2">
                                        <div className="h-3.5 bg-surface-800 rounded-full w-3/5" />
                                        <div className="h-2.5 bg-surface-800/60 rounded-full w-4/5" />
                                    </div>
                                    <div className="h-2.5 bg-surface-800/50 rounded w-8" />
                                </div>
                            ))}
                        </div>
                    ) : contacts.length === 0 ? (
                        <div className="p-6 text-center text-white0">No active chats</div>
                    ) : (
                        contacts.filter(contact => {
                            if (readFilter === 'unread' && (!contact.unreadCount || contact.unreadCount === 0)) return false;
                            if (readFilter === 'read' && contact.unreadCount > 0) return false;
                            
                            if (!searchQuery) return true;
                            const query = searchQuery.toLowerCase();
                            const nameMatch = contact.name && String(contact.name).toLowerCase().includes(query);
                            const phoneMatch = contact.recipient && String(contact.recipient).toLowerCase().includes(query);
                            return nameMatch || phoneMatch;
                        }).map((contact) => (
                            <div
                                key={contact.recipient}
                                onClick={() => isBulkMode ? handleSelectContact({target:{checked:!selectedContacts.includes(contact.recipient)}, stopPropagation: ()=>{}}, contact) : loadChatHistory(contact)}
                                className={`flex items-center gap-3 p-3 lg:p-4 cursor-pointer transition-colors duration-150 border-b border-white/5 last:border-0 ${selectedContact?.recipient === contact.recipient
                                    ? 'bg-surface-800/60 shadow-[inset_3px_0_0_#00d9a5]'
                                    : contact.unreadCount > 0 ? 'bg-surface-800/30 hover:bg-surface-800/50' : 'hover:bg-surface-800/40'
                                    }`}
                            >
                                {isBulkMode && (
                                    <div className="flex-shrink-0" onClick={e => e.stopPropagation()}>
                                        <input 
                                            type="checkbox" 
                                            checked={selectedContacts.includes(contact.recipient)}
                                            onChange={(e) => handleSelectContact(e, contact)}
                                            className="w-4 h-4 rounded border-surface-600 bg-surface-900 text-brand-500 focus:ring-brand-500"
                                        />
                                    </div>
                                )}
                                <div className="w-10 h-10 lg:w-12 lg:h-12 rounded-full bg-surface-800 border border-white/5 flex flex-shrink-0 items-center justify-center text-brand-400">
                                    <UserIcon size={18} />
                                </div>
                                <div className="flex-1 min-w-0 overflow-hidden">
                                    <div className="flex justify-between items-center mb-1">
                                        <h3 className={`font-semibold truncate text-sm ${contact.unreadCount > 0 ? 'text-white' : 'text-surface-200'}`}>
                                            {formatContactLabel(contact)}
                                        </h3>
                                        <span className={`text-[10px] lg:text-xs flex-shrink-0 ml-2 ${contact.unreadCount > 0 ? 'text-brand-400 font-medium' : 'text-white0'}`}>{formatTime(contact.timestamp)}</span>
                                    </div>
                                    <div className="flex items-center justify-between gap-2 overflow-hidden">
                                        <div className="flex items-center gap-1 min-w-0 flex-1">
                                            {contact.direction === 'OUTBOUND' && <span className="flex-shrink-0">{renderStatusIcon(contact.status)}</span>}
                                            <p className={`text-xs lg:text-sm truncate ${contact.unreadCount > 0 ? 'text-surface-200 font-medium' : 'text-surface-400'}`}>
                                                {contact.content?.type === 'template'
                                                    ? `[Template: ${contact.content.templateName || ''}]`
                                                    : contact.content?.type && typeof contact.content.type === 'string' && contact.content.type !== 'text'
                                                        ? `[${contact.content.type.toUpperCase()}] ${contact.content.caption || contact.content.fileName || ''}`
                                                        : (typeof contact.content?.text === 'string' ? contact.content.text : (contact.content?.text?.body || contact.content?.caption || 'Unsupported Message'))}
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-1 flex-shrink-0">
                                            {contact.contactStatus === 'RESOLVED' && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-green-500/20 text-green-400 font-semibold hidden lg:inline-block">✓ Done</span>}
                                            {contact.contactStatus === 'PENDING' && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-yellow-500/20 text-yellow-400 font-semibold hidden lg:inline-block">⏳ Wait</span>}
                                            {contact.unreadCount > 0 && (
                                                <div className="w-5 h-5 rounded-full bg-brand-500 flex items-center justify-center">
                                                    <span className="text-[10px] font-bold text-white">{contact.unreadCount}</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* RIGHT PANEL — flex-1 flex-col min-h-0 so it fills space and children can scroll */}
            <div className={`flex-1 min-h-0 flex flex-col bg-surface-950 ${!selectedContact ? 'hidden md:flex' : 'flex'}`}>
                {selectedContact ? (
                    <>
                        {/* HEADER — flex-shrink-0 so it never changes height */}
                        <div className="flex-shrink-0 px-5 py-4 border-b border-white/5 bg-surface-900/90 backdrop-blur-md z-10 flex items-center justify-between shadow-sm">
                            <div className="flex items-center gap-4">
                            {/* Back Button for Mobile */}
                            <button
                                onClick={() => setSelectedContact(null)}
                                className="md:hidden p-2 -ml-2 text-surface-400 hover:text-white"
                            >
                                <ArrowLeft size={20} />
                            </button>

                                <div className="w-10 h-10 rounded-full bg-surface-800 border border-white/5 flex items-center justify-center text-brand-400">
                                    <UserIcon size={18} />
                                </div>
                                <div className="flex flex-col">
                                    <h3 className="text-white font-semibold text-[15px] leading-tight">
                                        {formatContactLabel(selectedContact)}
                                    </h3>
                                    <span className="text-xs text-brand-400 font-medium">Online</span>
                                </div>
                            </div>

                            {/* BOT TOGGLE */}
                            <div className="flex items-center gap-2 md:gap-4">
                                <div className="flex items-center gap-2 pr-4 border-r border-surface-700">
                                    <span className={`text-xs font-semibold ${selectedContact.botPaused ? 'text-surface-400' : 'text-brand-400'}`}>
                                        {selectedContact.botPaused ? 'Bot Paused' : 'Bot Active'}
                                    </span>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input
                                            type="checkbox"
                                            className="sr-only peer"
                                            checked={!selectedContact.botPaused}
                                            onChange={async (e) => {
                                                const enabled = e.target.checked;
                                                try {
                                                    const res = await axios.put(`${import.meta.env.VITE_API_URL}/api/chat/${selectedContact.recipient}/bot`, { enabled });
                                                    // Update local state
                                                    const updatedContact = {
                                                        ...selectedContact,
                                                        botPaused: !enabled,
                                                        bot_paused_until: res.data.pausedUntil
                                                    };
                                                    setSelectedContact(updatedContact);
                                                    setContacts(prev => prev.map(c =>
                                                        c.recipient === updatedContact.recipient ? updatedContact : c
                                                    ));
                                                } catch (err) {
                                                    console.error("Failed to toggle bot", err);
                                                }
                                            }}
                                        />
                                        <div className="w-9 h-5 bg-surface-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-surface-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-brand-500"></div>
                                    </label>
                                </div>
                                <button
                                    onClick={handleDeleteChat}
                                    className="p-2 text-surface-400 hover:text-red-400 hover:bg-surface-800 rounded-lg transition-colors"
                                    title="Delete Chat History"
                                >
                                    <Trash2 size={18} />
                                </button>
                                <button
                                    onClick={() => setShowRightDrawer(!showRightDrawer)}
                                    className={`p-2 hidden md:block rounded-lg transition-colors ${showRightDrawer ? 'bg-brand-500/20 text-brand-400' : 'text-surface-400 hover:text-white hover:bg-surface-800'}`}
                                    title="Contact Info"
                                >
                                    <Info size={18} />
                                </button>
                            </div>
                        </div>

                        {/* MESSAGE AREA — flex-1 min-h-0 is the KEY fix for scroll stability */}
                        <div
                            ref={messagesEndRef.current ? undefined : undefined}
                            className="flex-1 min-h-0 overflow-y-auto px-6 py-4 space-y-2 relative"
                            style={{ backgroundColor: '#000000', overscrollBehavior: 'contain' }}
                            onDragOver={handleDragOver}
                            onDragLeave={handleDragLeave}
                            onDrop={handleDrop}
                        >
                            {isDragging && (
                                <div className="absolute inset-0 bg-brand-500/20 backdrop-blur-sm border-2 border-dashed border-brand-500 rounded-2xl m-4 flex flex-col items-center justify-center text-white z-30 pointer-events-none transition-all duration-300">
                                    <Upload size={48} className="text-brand-400 animate-bounce mb-2" />
                                    <p className="text-lg font-semibold text-brand-400">Drop files here to send</p>
                                    <p className="text-xs text-surface-400 mt-1">Image, Video, Audio, or Document up to 10MB</p>
                                </div>
                            )}
                            {messages.map((msg, idx) => {
                                const isOutbound = msg.direction === 'OUTBOUND';
                                const isRead = msg.status && String(msg.status).toUpperCase() === 'READ';
                                const msgTime = new Date(msg.timestamp).getTime();
                                const isExpired = (Date.now() - msgTime) > 24 * 60 * 60 * 1000;
                                const validUrl = msg.content?.mediaUrl || msg.content?.url;

                                return (
                                    <div key={msg.id || idx} className={`flex ${isOutbound ? 'justify-end' : 'justify-start'}`}>
                                        <div
                                            className={`max-w-[70%] px-4 py-2.5 relative transition-all ${isOutbound
                                                ? (msg.status === 'FAILED' ? 'bg-red-900/40 border border-red-500/30 text-red-300 rounded-2xl rounded-br-none' : 'bg-[#0d2b22] border border-[#1a4a35] text-[#e2e8f0] rounded-2xl rounded-br-none shadow-[0_2px_8px_rgba(0,217,165,0.08)]')
                                                : 'bg-[#1c1c1e] border border-white/[0.06] text-[#e2e8f0] rounded-2xl rounded-bl-none shadow-[0_2px_8px_rgba(0,0,0,0.4)]'
                                                }`}
                                        >
                                            <div className="text-[15px] font-normal leading-relaxed">
                                                {msg.status === 'FAILED' && msg.content?.failureReason && (
                                                    <div className="mb-2 p-2 bg-red-500/20 text-red-300 text-xs rounded-lg border border-red-500/20 font-medium">
                                                        ⚠️ Failed: {msg.content.failureReason}
                                                    </div>
                                                )}
                                                {msg.content?.type === 'template' ? (
                                                    <div className="flex flex-col gap-2">
                                                        <span className="text-[10px] uppercase font-bold tracking-wider opacity-70 mb-1 border-b border-surface-700/50 pb-1 flex items-center gap-1">
                                                            <Zap size={10} /> {msg.content.templateName}
                                                        </span>
                                                        
                                                        {Array.isArray(msg.content.components) && msg.content.components.find(c => c?.type === 'HEADER' && ['IMAGE', 'VIDEO', 'DOCUMENT'].includes(c?.format)) && (
                                                            <div className="mb-2 bg-surface-900/40 rounded p-4 text-center border border-surface-700/30 flex items-center justify-center text-xs text-surface-400">
                                                                [Template Media: {msg.content.components.find(c => c?.type === 'HEADER')?.format}]
                                                            </div>
                                                        )}

                                                        <p className="whitespace-pre-wrap">
                                                            {msg.content.resolvedBody ||
                                                                (Array.isArray(msg.content.components) ? msg.content.components.find(c => c?.type === 'BODY')?.text : '') ||
                                                                ''}
                                                        </p>

                                                        {Array.isArray(msg.content.components) && msg.content.components.find(c => c?.type === 'BUTTONS')?.buttons?.length > 0 && (
                                                            <div className="flex flex-col gap-1.5 mt-2 pt-2 border-t border-surface-700/50">
                                                                {msg.content.components.find(c => c?.type === 'BUTTONS').buttons.map((btn, i) => (
                                                                    <div key={i} className="flex items-center justify-center gap-2 w-full py-2 px-3 bg-surface-800/80 hover:bg-surface-800 rounded-lg border border-surface-600/50 text-xs font-semibold text-brand-400 cursor-default shadow-sm">
                                                                        {btn?.type === 'URL' ? <span className="text-blue-400">🔗</span> : btn?.type === 'PHONE_NUMBER' ? <span className="text-green-400">📞</span> : <span className="text-brand-400">↪️</span>}
                                                                        {btn?.text}
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                ) : msg.content?.type && typeof msg.content.type === 'string' && ['image', 'video', 'audio'].includes(msg.content.type.toLowerCase()) ? (
                                                    validUrl && !isExpired ? (
                                                        <div className="mb-2 rounded-lg overflow-hidden border border-surface-700/50 bg-black/20 relative group">
                                                            {String(msg.content.type).toLowerCase() === 'image' ? (
                                                                <img
                                                                    src={validUrl}
                                                                    alt={msg.content.fileName || "Image"}
                                                                    className="max-h-64 object-contain cursor-zoom-in hover:opacity-90 transition-opacity"
                                                                    onClick={() => setLightboxImage(validUrl)}
                                                                    onError={(e) => {
                                                                        e.target.style.display = 'none';
                                                                        const fallback = e.target.parentElement?.querySelector('.media-fallback');
                                                                        if (fallback) fallback.style.display = 'block';
                                                                    }}
                                                                />
                                                            ) : String(msg.content.type).toLowerCase() === 'audio' ? (
                                                                <audio
                                                                    src={validUrl}
                                                                    controls
                                                                    className="h-10 w-full min-w-[200px]"
                                                                    onError={(e) => {
                                                                        e.target.style.display = 'none';
                                                                        const fallback = e.target.parentElement?.querySelector('.media-fallback');
                                                                        if (fallback) fallback.style.display = 'block';
                                                                    }}
                                                                />
                                                            ) : (
                                                                <video
                                                                    src={validUrl}
                                                                    controls
                                                                    className="max-h-64 object-contain"
                                                                    onError={(e) => {
                                                                        e.target.style.display = 'none';
                                                                        const fallback = e.target.parentElement?.querySelector('.media-fallback');
                                                                        if (fallback) fallback.style.display = 'block';
                                                                    }}
                                                                />
                                                            )}
                                                            {/* Download Overlay for Images and Videos */}
                                                            <a
                                                                href={validUrl}
                                                                download={msg.content.fileName || "media"}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="absolute top-2 right-2 p-2 bg-black/60 hover:bg-brand-500 rounded-lg text-white opacity-0 group-hover:opacity-100 transition-all shadow-lg backdrop-blur-sm"
                                                                title="Download Media"
                                                            >
                                                                <Download size={16} />
                                                            </a>
                                                            <div className="media-fallback hidden p-3 bg-surface-900/60 text-surface-300 border border-surface-700/50 rounded-md shadow-sm">
                                                                <div className="flex justify-between items-center gap-2">
                                                                    <span className="block font-semibold text-xs opacity-80 break-all flex items-center gap-1">
                                                                        📄 [{msg.content.type.toUpperCase()}]: {msg.content.fileName || 'Attachment Expired'}
                                                                    </span>
                                                                    <a
                                                                        href={validUrl}
                                                                        download={msg.content.fileName || "media"}
                                                                        target="_blank"
                                                                        rel="noopener noreferrer"
                                                                        className="p-1 hover:bg-surface-700 rounded transition-colors text-surface-300 hover:text-white flex-shrink-0"
                                                                        title="Download"
                                                                    >
                                                                        <Download size={16} />
                                                                    </a>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <span className="block mb-1 font-semibold text-xs opacity-80 break-all bg-surface-900/40 p-2 rounded-md border border-surface-700/30 flex items-center justify-between gap-2">
                                                            <span>📄 {String(msg.content.type).toUpperCase()}: {msg.content.fileName || (isExpired ? 'Media Expired' : 'Processing Media...')}</span>
                                                            {validUrl && !isExpired && (
                                                                <a
                                                                    href={validUrl}
                                                                    download={msg.content.fileName || "download"}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    className="p-1 hover:bg-surface-700 rounded transition-colors text-surface-300 hover:text-white"
                                                                    title="Download"
                                                                >
                                                                    <Download size={14} />
                                                                </a>
                                                            )}
                                                        </span>
                                                    )
                                                ) : (msg.content?.type && msg.content.type !== 'text') ? (
                                                    <span className="block mb-1 font-semibold text-xs opacity-80 break-all bg-surface-900/40 p-2 rounded-md border border-surface-700/30 flex items-center justify-between gap-2">
                                                        <span>📄 {String(msg.content.type).toUpperCase()}: {msg.content.fileName || 'Attachment'}</span>
                                                        {validUrl && (
                                                            <a
                                                                href={validUrl}
                                                                download={msg.content.fileName || "download"}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="p-1 hover:bg-surface-700 rounded transition-colors text-surface-300 hover:text-white"
                                                                title="Download"
                                                            >
                                                                <Download size={14} />
                                                            </a>
                                                        )}
                                                    </span>
                                                ) : null}
                                                <p className="whitespace-pre-wrap">{typeof msg.content?.text === 'string' ? msg.content.text : (msg.content?.text?.body || msg.content?.caption || '')}</p>
                                            </div>
                                            <div className="flex items-center justify-end gap-1 mt-1 opacity-60">
                                                <span className={`text-[11px] ${msg.status === 'FAILED' ? 'text-red-400' : ''}`}>{formatTime(msg.timestamp)}</span>
                                                {isOutbound && (msg.status === 'FAILED' ? <X size={12} className="text-red-400" /> : renderStatusIcon(msg.status))}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                            <div ref={messagesEndRef} />
                        </div>

                        {/* INPUT FOOTER — flex-shrink-0, always anchored to bottom */}
                        <div className="flex-shrink-0 relative z-10 bg-surface-900 border-t border-white/5 shadow-[0_-4px_24px_rgba(0,0,0,0.3)]">
                            {/* ── 24-Hour Window Indicator ── */}
                            {selectedContact && (() => {
                                const lastInbound = messages.slice().reverse().find(m => m.direction === 'INBOUND');
                                const lastTs = lastInbound?.timestamp || selectedContact?.timestamp;
                                const hoursLeft = lastTs ? Math.max(0, 24 - (Date.now() - new Date(lastTs).getTime()) / 3600000) : 0;
                                const windowExpired = hoursLeft <= 0;
                                const windowWarning = hoursLeft > 0 && hoursLeft <= 3;
                                if (!windowExpired && !windowWarning) return null;
                                return (
                                    <div className={`mx-4 mt-2 px-4 py-2.5 rounded-xl border text-xs font-medium flex items-center gap-2 ${windowExpired ? 'bg-red-500/10 border-red-500/30 text-red-300' : 'bg-yellow-500/10 border-yellow-500/30 text-yellow-300'}`}>
                                        <AlertCircle size={14} className="flex-shrink-0" />
                                        <span className="flex-1">
                                            {windowExpired ? '⏰ 24hr messaging window expired. Send a template to re-open it.' : `⚠️ Window closing in ${hoursLeft.toFixed(0)}h — send a template to extend it.`}
                                        </span>
                                        <button onClick={() => setShowTemplatePanel(true)}
                                            className={`px-2.5 py-1 rounded-lg font-semibold text-xs transition-all ${windowExpired ? 'bg-red-500/30 hover:bg-red-500/50 text-red-200' : 'bg-yellow-500/30 hover:bg-yellow-500/50 text-yellow-200'}`}>
                                            Send Template
                                        </button>
                                    </div>
                                );
                            })()}

                            {filePreview && (
                                <div className="flex items-center gap-3 p-2 bg-surface-800 rounded-xl relative w-fit mx-4 mt-2 border border-white/5 shadow-xl">
                                    {selectedFile?.type?.startsWith('image/') ? (
                                        <img src={filePreview} alt="Preview" className="h-16 w-16 object-cover rounded-lg border border-surface-700" />
                                    ) : selectedFile?.type?.startsWith('audio/') ? (
                                        <div className="h-12 px-2 bg-brand-500/10 rounded-lg flex items-center justify-center border border-brand-500/20">
                                            <audio src={filePreview} controls className="h-8 max-w-[200px]" />
                                        </div>
                                    ) : (
                                        <div className="h-16 px-4 bg-brand-500/20 text-brand-400 rounded-lg flex items-center justify-center font-semibold text-xs border border-brand-500/30">
                                            {selectedFile?.name?.substring(0, 20)}...
                                        </div>
                                    )}
                                    <button onClick={removeFile} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 border-2 border-surface-900 hover:bg-red-600 transition-colors shadow-md">
                                        <X size={12} />
                                    </button>
                                </div>
                            )}

                            {/* FORM ROW */}
                            <div className="px-4 py-3 relative">
                            <form onSubmit={handleSendMessage} className="flex items-center gap-3 bg-surface-950 border border-white/10 p-2 rounded-[24px] shadow-inner">

                                {/* Attachment */}
                                <button type="button" onClick={() => fileInputRef.current?.click()}
                                    className="w-10 h-10 rounded-full bg-transparent hover:bg-surface-800 text-surface-400 hover:text-surface-600 transition-all duration-300 flex items-center justify-center flex-shrink-0" title="Attach File">
                                    <Paperclip size={19} />
                                </button>
                                <input type="file" ref={fileInputRef} onChange={handleFileSelect} className="hidden"
                                    accept="image/*,application/pdf,video/*,audio/*,.doc,.docx,.xls,.xlsx" />

                                {/* Image paste input (invisible) */}
                                <input type="file" accept="image/*" className="hidden" id="img-paste-input"
                                    onChange={e => { if(e.target.files[0]) { setSelectedFile(e.target.files[0]); const r = new FileReader(); r.onloadend = () => setFilePreview(r.result); r.readAsDataURL(e.target.files[0]); }}} />

                                <input ref={inputRef} type="text" value={inputText}
                                    onChange={(e) => setInputText(e.target.value)}
                                    onPaste={async (e) => {
                                        const items = Array.from(e.clipboardData?.items || []);
                                        const imgItem = items.find(i => i.type.startsWith('image/'));
                                        if (imgItem) {
                                            e.preventDefault();
                                            const file = imgItem.getAsFile();
                                            setSelectedFile(file);
                                            const reader = new FileReader();
                                            reader.onloadend = () => setFilePreview(reader.result);
                                            reader.readAsDataURL(file);
                                        }
                                    }}
                                    placeholder={selectedContact?.botPaused ? "Type a message..." : "Bot is active. Type to pause..."}
                                    className="flex-1 !bg-transparent !border-none !outline-none !shadow-none focus:!ring-0 text-white placeholder-surface-500 text-[15px]"
                                />

                                {/* Emojis */}
                                <div className="relative">
                                    <button type="button" onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                                        className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${showEmojiPicker ? 'bg-surface-800 text-brand-500' : 'text-surface-400 hover:text-surface-600 hover:bg-surface-800'}`} title="Emojis">
                                        😀
                                    </button>
                                </div>

                                {/* Templates Quick Send */}
                                <button type="button" onClick={() => setShowTemplatePanel(true)}
                                    className="w-10 h-10 rounded-full bg-transparent hover:bg-surface-800 text-surface-400 hover:text-surface-600 transition-all duration-300 flex items-center justify-center flex-shrink-0" title="Send Template">
                                    <ZapIcon size={19} />
                                </button>

                                {/* Send Button */}
                                
                                {(!inputText.trim() && !selectedFile && !isRecording) ? (
                                    <button type="button" onClick={startRecording}
                                        className="w-10 h-10 rounded-full bg-brand-500 hover:bg-brand-600 text-white flex items-center justify-center transition-all duration-300 flex-shrink-0 shadow-md">
                                        <Mic size={18} />
                                    </button>
                                ) : isRecording ? (
                                    <button type="button" onClick={handleSendWhileRecording}
                                        className="w-10 h-10 rounded-full bg-brand-500 hover:bg-brand-600 text-white flex items-center justify-center transition-all duration-300 flex-shrink-0 shadow-md">
                                        <Send size={18} className="ml-1" />
                                    </button>
                                ) : (
                                    <button type="submit" disabled={(!inputText.trim() && !selectedFile)}
                                        className="w-10 h-10 rounded-full bg-brand-500 hover:bg-brand-600 text-white flex items-center justify-center transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0 shadow-md">
                                        <Send size={18} className="ml-1" />
                                    </button>
                                )}
                            </form>

                            {/* ── Emoji Picker Panel (uses component-level state, no IIFE) ── */}
                            {showEmojiPicker && (() => {
                                const EMOJI_CATS = [
                                    { icon: '😊', emojis: ['😀','😃','😄','😁','😆','😅','🤣','😂','🙂','🙃','😉','😊','😇','🥰','😍','🤩','😘','😗','😚','😙','😋','😛','😜','🤪','😝','🤑','🤗','🤭','🤫','🤔','🤐','🤨','😐','😑','😶','😏','😒','🙄','😬','🤥','😌','😔','😪','🤤','😴','😷','🤒','🤕','🤢','🤮','🤧','🥵','🥶','🥴','😵','🤯','🤠','🥳','🥸','😎','🤓','🧐','😕','😟','🙁','☹️','😮','😯','😲','😳','🥺','😦','😧','😨','😰','😥','😢','😭','😱','😖','😣','😞','😓','😩','😫','🥱','😤','😡','😠','🤬','😈','👿','💀','💩','🤡','👹','👺','👻','👽','👾','🤖'] },
                                    { icon: '👋', emojis: ['👋','🤚','🖐️','✋','🖖','👌','🤌','🤏','✌️','🤞','🤟','🤘','🤙','👈','👉','👆','👇','☝️','👍','👎','✊','👊','🤛','🤜','👏','🙌','👐','🤲','🤝','🙏','✍️','💅','💪','💀','👀','👅','👄'] },
                                    { icon: '❤️', emojis: ['❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','💔','❣️','💕','💞','💓','💗','💖','💘','💝','💟','✅','☑️','✔️','❎','⭕','🔥','⚡','🌟','✨','💫','⭐','🌈','☀️','🌙','❄️','🌊','🎯','💯','🆗','🆙','🆒','🆕','🆓','🔴','🟠','🟡','🟢','🔵','🟣','⚫','⚪'] },
                                    { icon: '🎉', emojis: ['🎉','🎊','🎈','🎀','🎁','🏆','🥇','🥈','🥉','🏅','🎪','🎭','🎨','🎬','🎤','🎧','🎵','🎶','🎷','🎸','🎹','🎺','🎻','🥁','🎮','🕹️','🎲','🎯','🎳','🎰','🧸','🎠','🎡','🎢','🎪'] },
                                    { icon: '🌸', emojis: ['🌸','🌺','🌻','🌹','🌷','💐','🌼','🪷','🌱','🌿','🍃','🍂','🍁','🍀','☘️','🌾','🎋','🌲','🌳','🌴','🌵','🌊','🌬️','🌀','🌈','⚡','🌤️','⛅','☁️','🌧️','⛈️','🌩️','❄️','☃️','⛄','💨','💧','💦'] },
                                    { icon: '🍕', emojis: ['🍕','🍔','🍟','🌭','🌮','🌯','🥙','🧆','🥚','🍳','🥘','🍲','🥣','🥗','🍿','🥫','🍱','🍘','🍙','🍚','🍛','🍜','🍝','🍣','🍤','🍡','🧁','🎂','🍰','🍭','🍬','🍫','🍩','🍪','🍦','🍧','🍨','🍷','🍸','🍹','🍺','☕','🧋','🧃','🥤'] },
                                    { icon: '🚗', emojis: ['🚗','🚕','🚙','🚌','🏎️','🚓','🚑','🚒','🛻','🚚','🚛','🚜','🏍️','🛵','🚲','🛴','✈️','🛫','🛬','💺','🚀','🛸','🛶','⛵','🚤','🚢','🗺️','🧭','🏖️','🏝️','🗻','🏔️','🏕️','🏗️','🏙️','🌆','🌃','🌉'] },
                                    { icon: '💼', emojis: ['💼','👜','👛','🎒','🧳','💰','💳','📱','💻','🖥️','⌨️','🖱️','🖨️','📷','📸','📹','🎥','📞','☎️','📟','📠','📺','📻','🔌','🔋','💡','🔦','🕯️','📖','📚','📝','✏️','🖊️','🖋️','📌','📍','📎','🖇️','📏','📐','✂️','🗂️','🗒️','🗓️','📅','📆','🔑','🗝️','🔒','🔓','🔨','⚒️','🛠️','⚙️','🔧','🔩'] },
                                ];
                                return (
                                    <div ref={emojiPickerRef} className="absolute bottom-full mb-2 left-0 right-0 mx-4 bg-[#141414] border border-surface-700 rounded-2xl shadow-2xl overflow-hidden z-20" style={{maxHeight:'300px'}}>
                                        {/* Category Tabs */}
                                        <div className="flex gap-1 p-2 pb-1 overflow-x-auto border-b border-surface-800">
                                            {EMOJI_CATS.map((cat, i) => (
                                                <button key={i} type="button" onClick={() => setEmojiCat(i)}
                                                    className={`flex-shrink-0 w-8 h-8 rounded-lg text-lg flex items-center justify-center transition-all ${emojiCat === i ? 'bg-brand-500/20 ring-1 ring-brand-500/40' : 'hover:bg-surface-700'}`}>
                                                    {cat.icon}
                                                </button>
                                            ))}
                                        </div>
                                        {/* Emoji Grid */}
                                        <div className="p-2 grid grid-cols-10 gap-0.5 overflow-y-auto" style={{maxHeight:'220px'}}>
                                            {EMOJI_CATS[emojiCat].emojis.map((em, i) => (
                                                <button key={i} type="button"
                                                    onClick={() => { setInputText(prev => prev + em); inputRef.current?.focus(); }}
                                                    className="w-8 h-8 flex items-center justify-center text-[18px] rounded-lg hover:bg-surface-700 transition-colors cursor-pointer">
                                                    {em}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                );
                            })()}


                            {/* ── Template Quick-Send Panel ── */}
                            {showTemplatePanel && (
                                <div className="absolute bottom-full mb-2 left-0 right-0 mx-4 bg-surface-900 border border-surface-700 rounded-2xl shadow-2xl overflow-hidden z-20 max-h-72">
                                    <div className="p-3 border-b border-surface-800 flex items-center justify-between">
                                        <span className="text-sm font-semibold text-white flex items-center gap-2"><ZapIcon size={14} className="text-brand-400" /> Approved Templates</span>
                                        <button onClick={() => setShowTemplatePanel(false)} className="text-surface-400 hover:text-white"><X size={15} /></button>
                                    </div>
                                    <div className="p-2 border-b border-surface-800">
                                        <input type="text" placeholder="Search templates..." value={templateSearch}
                                            onChange={e => setTemplateSearch(e.target.value)}
                                            className="w-full bg-surface-800 border border-surface-700 rounded-lg px-3 py-1.5 text-sm text-white placeholder-surface-500 outline-none focus:border-brand-500/50" />
                                    </div>
                                    <div className="overflow-y-auto max-h-48">
                                        {templates.filter(t => t?.name && String(t.name).toLowerCase().includes(templateSearch.toLowerCase())).length === 0 ? (
                                            <div className="p-4 text-center text-surface-500 text-sm">No approved templates found</div>
                                        ) : (
                                            templates.filter(t => t.name && String(t.name).toLowerCase().includes(templateSearch.toLowerCase())).map(t => (
                                                <button key={t.id || t.name} onClick={() => handleSendTemplate(t)}
                                                    className="w-full text-left px-4 py-3 hover:bg-surface-800 transition-colors border-b border-surface-800/50 last:border-0">
                                                    <p className="text-sm font-semibold text-white">{t.name}</p>
                                                    <p className="text-xs text-surface-400 truncate mt-0.5">{t.components?.find(c => c.type === 'BODY')?.text || t.body || '—'}</p>
                                                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-500/20 text-green-400 mt-1 inline-block">{t.language || 'en'}</span>
                                                </button>
                                            ))
                                        )}
                                    </div>
                                </div>
                            )}
                            </div>{/* end FORM ROW px-4 py-3 */}
                        </div>{/* end INPUT FOOTER */}
                    </>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-white0">
                        <div className="w-20 h-20 rounded-full bg-surface-800 flex items-center justify-center mb-4">
                            <Send size={32} className="text-surface-600" />
                        </div>
                        <h3 className="text-xl font-semibold text-white mb-2">WhatsApp Live Chat</h3>
                        <p>Select a contact from the left menu to view messages or start a conversation.</p>
                    </div>
                )}
            </div>

            {/* Right Drawer: 3-Tab CRM Panel */}
            {selectedContact && showRightDrawer && (
                <div className="w-[320px] hidden lg:flex flex-col border-l border-white/5 bg-surface-900 flex-shrink-0 shadow-[-4px_0_24px_rgba(0,0,0,0.5)] z-20">
                    {/* Drawer Header */}
                    <div className="p-4 border-b border-white/5 flex items-center justify-between flex-shrink-0 bg-surface-950/50">
                        <div className="flex gap-1 flex-wrap">
                            {[
                                { id: 'info', icon: <Info size={14} />, label: 'Info' },
                                { id: 'comments', icon: <MessageSquare size={14} />, label: 'Comments' },
                                { id: 'actions', icon: <Zap size={14} />, label: 'Actions' }
                            ].map(tab => (
                                <button
                                    key={tab.id}
                                    onClick={() => setDrawerTab(tab.id)}
                                    className={`flex items-center gap-1.5 px-3 py-2 rounded-[10px] text-xs font-semibold transition-all duration-300 ${drawerTab === tab.id ? 'bg-brand-500 text-surface-950 shadow-[0_0_10px_rgba(0,217,165,0.3)]' : 'text-surface-400 hover:text-white hover:bg-surface-800'}`}
                                >
                                    {tab.icon} {tab.label}
                                    {tab.id === 'comments' && comments.length > 0 && (
                                        <span className="ml-0.5 bg-brand-400/30 text-brand-300 rounded-full px-1.5 text-[9px]">{comments.length}</span>
                                    )}
                                </button>
                            ))}
                        </div>
                        <button onClick={() => setShowRightDrawer(false)} className="text-surface-400 hover:text-white p-1 rounded flex-shrink-0 ml-1">
                            <X size={16} />
                        </button>
                    </div>

                    {/* Tab: Info & Assign */}
                    {drawerTab === 'info' && (
                        <div className="flex-1 overflow-y-auto p-4 space-y-4">
                            <div>
                                <label className="block text-xs font-medium text-surface-400 mb-1">Client Name</label>
                                <input type="text" value={crmName} onChange={(e) => setCrmName(e.target.value)} className="input-field w-full text-sm" placeholder="Enter name..." />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-surface-400 mb-1">Phone Number</label>
                                <div className="p-2 bg-surface-800 rounded-lg text-sm text-surface-300 font-mono">{formatPhone(selectedContact.recipient)}</div>
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-surface-400 mb-1">Assign To Team Member</label>
                                <select value={crmAssignee} onChange={(e) => setCrmAssignee(e.target.value)} className="input-field w-full text-sm">
                                    <option value="">Unassigned</option>
                                    {teamMembers.map(member => (
                                        <option key={member.id} value={member.id}>{member.name}</option>
                                    ))}
                                </select>
                                {crmAssignee && (
                                    <p className="text-xs text-brand-400 mt-1">⚡ Team member will get notified on save</p>
                                )}
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-surface-400 mb-1">Private Notes</label>
                                <textarea value={crmNotes} onChange={(e) => setCrmNotes(e.target.value)} className="input-field w-full text-sm min-h-[100px] resize-none" placeholder="Add internal notes..." />
                            </div>
                            <button onClick={saveCrmDetails} className="w-full flex items-center justify-center gap-2 py-2 bg-brand-500 hover:bg-brand-600 text-white rounded-lg transition-colors font-medium text-sm">
                                <Save size={15} /> Save Details
                            </button>
                        </div>
                    )}

                    {/* Tab: Comments */}
                    {drawerTab === 'comments' && (
                        <div className="flex-1 flex flex-col overflow-hidden">
                            <div className="flex-1 overflow-y-auto p-3 space-y-3">
                                {comments.length === 0 ? (
                                    <div className="text-center text-surface-500 text-sm py-8">
                                        <MessageSquare size={28} className="mx-auto mb-2 opacity-30" />
                                        No internal comments yet
                                    </div>
                                ) : (
                                    comments.map(c => (
                                        <div key={c.id} className="bg-surface-800 rounded-xl p-3">
                                            <div className="flex items-center justify-between mb-1">
                                                <span className="text-xs font-semibold text-brand-400">{c.author?.name || 'Team'}</span>
                                                <span className="text-[10px] text-surface-500">{!isNaN(new Date(c.createdAt).getTime()) ? new Date(c.createdAt).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''}</span>
                                            </div>
                                            <p className="text-sm text-surface-200 whitespace-pre-wrap">{c.text}</p>
                                        </div>
                                    ))
                                )}
                            </div>
                            <div className="p-4 border-t border-white/5 flex-shrink-0 bg-surface-950/50">
                                <textarea
                                    value={newComment}
                                    onChange={(e) => setNewComment(e.target.value)}
                                    onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); postComment(); }}}
                                    placeholder="Write an internal comment... (Enter to post)"
                                    className="input-field w-full text-sm min-h-[70px] resize-none mb-2"
                                />
                                <button
                                    onClick={postComment}
                                    disabled={postingComment || !newComment.trim()}
                                    className="w-full flex items-center justify-center gap-2 py-2.5 bg-brand-500 hover:bg-brand-400 disabled:opacity-50 text-surface-950 rounded-[12px] transition-all duration-300 font-semibold text-sm shadow-[0_0_15px_rgba(0,217,165,0.2)]"
                                >
                                    <MessageSquare size={14} /> {postingComment ? 'Posting...' : 'Post Comment'}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Tab: Actions */}
                    {drawerTab === 'actions' && (
                        <div className="flex-1 overflow-y-auto p-4 space-y-5">
                            <div>
                                <label className="block text-xs font-medium text-surface-400 mb-2">Conversation Status</label>
                                <div className="flex flex-col gap-2">
                                    {[
                                        { value: 'OPEN', label: 'Open', icon: <RotateCcw size={14} />, color: 'text-blue-400 bg-blue-500/10 border-blue-500/30 hover:bg-blue-500/20' },
                                        { value: 'PENDING', label: 'Pending', icon: <AlertCircle size={14} />, color: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30 hover:bg-yellow-500/20' },
                                        { value: 'RESOLVED', label: 'Resolved', icon: <CheckCircle size={14} />, color: 'text-green-400 bg-green-500/10 border-green-500/30 hover:bg-green-500/20' }
                                    ].map(s => (
                                        <button
                                            key={s.value}
                                            onClick={() => handleStatusChange(s.value)}
                                            className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border text-sm font-medium transition-all ${crmStatus === s.value ? s.color + ' ring-1 ring-current' : 'border-surface-700 text-surface-400 hover:bg-surface-800'}`}
                                        >
                                            {s.icon} {s.label}
                                            {crmStatus === s.value && <span className="ml-auto text-[10px] opacity-70">● Active</span>}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div className="border-t border-surface-700 pt-4">
                                <label className="block text-xs font-medium text-surface-400 mb-2">Bot Control</label>
                                <div className="flex items-center justify-between p-3 bg-surface-800 rounded-xl">
                                    <div>
                                        <p className="text-sm font-medium text-white">AI Bot</p>
                                        <p className="text-xs text-surface-400">{selectedContact.botPaused ? 'Paused for 24h' : 'Currently Active'}</p>
                                    </div>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input type="checkbox" className="sr-only peer" checked={!selectedContact.botPaused}
                                            onChange={async (e) => {
                                                const enabled = e.target.checked;
                                                try {
                                                    const res = await axios.put(`${import.meta.env.VITE_API_URL}/api/chat/${selectedContact.recipient}/bot`, { enabled });
                                                    const updatedContact = { ...selectedContact, botPaused: !enabled, bot_paused_until: res.data.pausedUntil };
                                                    setSelectedContact(updatedContact);
                                                    setContacts(prev => prev.map(c => c.recipient === updatedContact.recipient ? updatedContact : c));
                                                    showToast(`Bot ${enabled ? 'enabled' : 'paused'}`, 'success');
                                                } catch (err) { showToast('Failed to toggle bot', 'error'); }
                                            }}
                                        />
                                        <div className="w-9 h-5 bg-surface-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-surface-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-brand-500"></div>
                                    </label>
                                </div>
                            </div>
                            <div className="border-t border-surface-700 pt-4">
                                <label className="block text-xs font-medium text-surface-400 mb-2">Danger Zone</label>
                                <button onClick={handleDeleteChat} className="w-full flex items-center justify-center gap-2 py-2 border border-red-500/30 text-red-400 hover:bg-red-500/10 rounded-lg transition-colors font-medium text-sm">
                                    <Trash2 size={14} /> Delete Chat History
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}
            
            {/* Image Lightbox Modal */}
            {lightboxImage && (
                <div 
                    className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-md flex items-center justify-center animate-fade-in"
                    onClick={() => setLightboxImage(null)}
                >
                    <button 
                        onClick={() => setLightboxImage(null)} 
                        className="absolute top-4 right-4 text-white hover:text-brand-400 bg-white/10 hover:bg-white/20 p-3 rounded-full transition-colors z-[110]"
                        title="Close"
                    >
                        <X size={24} />
                    </button>
                    <a
                        href={lightboxImage}
                        download={selectedContact?.name || "image"}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="absolute top-4 right-20 text-white hover:text-brand-400 bg-white/10 hover:bg-white/20 p-3 rounded-full transition-colors z-[110]"
                        title="Download Image"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <Download size={24} />
                    </a>
                    <img 
                        src={lightboxImage} 
                        alt="Enlarged" 
                        className="max-w-[90vw] max-h-[85vh] object-contain rounded-lg shadow-2xl transition-transform duration-300"
                        onClick={(e) => e.stopPropagation()}
                    />
                </div>
            )}
        </div>
    );
};

export default LiveChat;

