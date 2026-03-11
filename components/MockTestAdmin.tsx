import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Icon } from './Icon';
import { createMockTest, getMockTests, deleteMockTest, generateTickets, getMockTestById, updateMockTest, getTickets, deleteTicket, resetTicket, getMockTestResults } from '../services/mockTest';
import { MockTest, MockTestQuestion, MockTestTicket, MockTestResult } from '../types';
import { db, storage } from '../firebase';

export const MockTestAdmin: React.FC = () => {
    const [tests, setTests] = useState<MockTest[]>([]);
    const [loading, setLoading] = useState(true);
    const [view, setView] = useState<'list' | 'create' | 'edit' | 'tickets'>('list');
    
    // Create/Edit Form State
    const [editingTestId, setEditingTestId] = useState<string | null>(null);
    const [newTestTitle, setNewTestTitle] = useState('');
    const [newTestAudio, setNewTestAudio] = useState('');
    const [questionsInput, setQuestionsInput] = useState(''); // Bulk input for questions
    const [creating, setCreating] = useState(false);

    // File Upload State
    const [uploading, setUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [uploadedUrl, setUploadedUrl] = useState('');

    // Ticket Generation State
    const [selectedTestId, setSelectedTestId] = useState('');
    const [ticketCount, setTicketCount] = useState(10);
    const [generatedCodes, setGeneratedCodes] = useState<string[]>([]);
    
    // Ticket Management State
    const [allTickets, setAllTickets] = useState<MockTestTicket[]>([]);
    const [results, setResults] = useState<MockTestResult[]>([]);
    const [loadingTickets, setLoadingTickets] = useState(false);

    useEffect(() => {
        loadTests();
    }, []);

    const loadTests = async () => {
        setLoading(true);
        try {
            const data = await getMockTests();
            setTests(data);
        } catch (e) {
            console.error(e);
            alert('Error loading tests');
        } finally {
            setLoading(false);
        }
    };

    const loadTickets = async () => {
        setLoadingTickets(true);
        try {
            const [ticketsData, resultsData] = await Promise.all([
                getTickets(),
                getMockTestResults()
            ]);
            setAllTickets(ticketsData);
            setResults(resultsData);
        } catch (e) {
            console.error(e);
            alert('Error loading tickets');
        } finally {
            setLoadingTickets(false);
        }
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setUploading(true);
        setUploadProgress(0);
        setUploadedUrl('');

        try {
            const storageRef = storage.ref();
            const fileRef = storageRef.child(`mock-tests/${Date.now()}_${file.name}`);
            const uploadTask = fileRef.put(file);

            uploadTask.on('state_changed', 
                (snapshot) => {
                    const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                    setUploadProgress(progress);
                }, 
                (error) => {
                    console.error("Upload error:", error);
                    alert("Upload failed!");
                    setUploading(false);
                }, 
                async () => {
                    const downloadURL = await uploadTask.snapshot.ref.getDownloadURL();
                    setUploadedUrl(downloadURL);
                    setUploading(false);
                }
            );
        } catch (error) {
            console.error("Error uploading file:", error);
            alert("Error uploading file");
            setUploading(false);
        }
    };

    const handleCreateOrUpdateTest = async (e: React.FormEvent) => {
        e.preventDefault();
        setCreating(true);

        try {
            // Parse Questions (Relaxed JSON / JavaScript Object Format)
            let parsedQuestions: MockTestQuestion[] = [];
            try {
                // Use Function constructor to allow relaxed JSON (comments, backticks, single quotes, etc.)
                // This is safe enough for an admin tool used by the owner.
                const parseRelaxedJSON = (str: string) => new Function('return ' + str)();
                parsedQuestions = parseRelaxedJSON(questionsInput);
                
                if (!Array.isArray(parsedQuestions)) throw new Error('Input must be an array');
            } catch (e) {
                console.error(e);
                alert('Invalid format. Please check your syntax (Brackets, Commas, Backticks).');
                setCreating(false);
                return;
            }

            if (parsedQuestions.length === 0) {
                alert('Please add at least one question.');
                setCreating(false);
                return;
            }

            // Basic Validation
            for (let i = 0; i < parsedQuestions.length; i++) {
                const q = parsedQuestions[i];
                
                // Skip validation for directions
                if (q.type === 'direction') {
                    if (!q.content) {
                        alert(`Direction at index ${i} is missing content.`);
                        setCreating(false);
                        return;
                    }
                    continue;
                }

                if (!q.id || !q.part || q.correctAnswer === undefined || !q.options) {
                    alert(`Question at index ${i} is missing required fields (id, part, correctAnswer, options).`);
                    setCreating(false);
                    return;
                }
            }

            if (editingTestId) {
                await updateMockTest(editingTestId, {
                    title: newTestTitle,
                    audioUrl: newTestAudio,
                    questions: parsedQuestions
                });
                alert('Test Updated Successfully!');
            } else {
                await createMockTest({
                    title: newTestTitle,
                    audioUrl: newTestAudio,
                    status: 'Active',
                    questions: parsedQuestions
                });
                alert('Test Created Successfully!');
            }

            setView('list');
            setNewTestTitle('');
            setNewTestAudio('');
            setQuestionsInput('');
            setEditingTestId(null);
            loadTests();
        } catch (e) {
            console.error(e);
            alert('Error saving test');
        } finally {
            setCreating(false);
        }
    };

    const handleEditTest = (test: MockTest) => {
        setEditingTestId(test.id);
        setNewTestTitle(test.title);
        setNewTestAudio(test.audioUrl || '');
        
        // Convert questions back to formatted JSON string
        // We use JSON.stringify with null, 2 for pretty printing
        // But we need to be careful with backticks if we want to preserve the template literal style
        // For simplicity, we'll just output standard JSON, which is valid input for our relaxed parser too.
        setQuestionsInput(JSON.stringify(test.questions, null, 2));
        
        setView('edit');
    };

    const handleDeleteTest = async (id: string) => {
        if (!window.confirm('Are you sure? This will delete the test and all associated results.')) return;
        try {
            await deleteMockTest(id);
            loadTests();
        } catch (e) {
            console.error(e);
            alert('Error deleting test');
        }
    };

    const handleGenerateTickets = async () => {
        if (!selectedTestId) {
            alert('Please select a test first.');
            return;
        }
        setCreating(true);
        try {
            const codes = await generateTickets(ticketCount, selectedTestId);
            setGeneratedCodes(codes);
            loadTickets(); // Refresh ticket list
        } catch (e) {
            console.error(e);
            alert('Error generating tickets');
        } finally {
            setCreating(false);
        }
    };

    const handleDeleteTicket = async (id: string) => {
        if (!window.confirm('Delete this ticket?')) return;
        try {
            await deleteTicket(id);
            loadTickets();
        } catch (e) {
            console.error(e);
            alert('Error deleting ticket');
        }
    };

    const handleResetTicket = async (id: string) => {
        if (!window.confirm('Reset this ticket to "Unused"? This will clear all progress.')) return;
        try {
            await resetTicket(id);
            loadTickets();
        } catch (e) {
            console.error(e);
            alert('Error resetting ticket');
        }
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        alert('Copied!');
    };

    // Load tickets when view changes to tickets
    useEffect(() => {
        if (view === 'tickets') {
            loadTickets();
        }
    }, [view]);

    if (loading) return <div className="p-8 text-center">Loading...</div>;

    return (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                    <Icon name="school" className="text-primary" /> TOEIC Mock Test Manager
                </h2>
                <div className="flex gap-2">
                    <button 
                        onClick={() => { setView('list'); setEditingTestId(null); }}
                        className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${view === 'list' ? 'bg-slate-100 text-slate-800' : 'text-slate-500 hover:bg-slate-50'}`}
                    >
                        Tests List
                    </button>
                    <button 
                        onClick={() => { 
                            setView('create'); 
                            setEditingTestId(null);
                            setNewTestTitle('');
                            setNewTestAudio('');
                            setQuestionsInput('');
                        }}
                        className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${view === 'create' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-slate-500 hover:bg-slate-50'}`}
                    >
                        + New Test
                    </button>
                    <button 
                        onClick={() => setView('tickets')}
                        className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${view === 'tickets' ? 'bg-green-600 text-white shadow-lg shadow-green-600/20' : 'text-slate-500 hover:bg-slate-50'}`}
                    >
                        Manage Tickets
                    </button>
                </div>
            </div>

            {view === 'list' && (
                <div className="space-y-4">
                    {tests.length === 0 ? (
                        <div className="text-center py-12 text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                            No tests found. Create one to get started.
                        </div>
                    ) : (
                        tests.map(test => (
                            <div key={test.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-200 hover:border-primary/30 transition-colors">
                                <div>
                                    <h3 className="font-bold text-slate-800">{test.title}</h3>
                                    <p className="text-xs text-slate-500">
                                        {test.questions.length} Questions &bull; Created: {new Date(test.createdAt).toLocaleDateString()}
                                    </p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className={`px-2 py-1 rounded text-xs font-bold ${test.status === 'Active' ? 'bg-green-100 text-green-700' : 'bg-slate-200 text-slate-600'}`}>
                                        {test.status}
                                    </span>
                                    <button 
                                        onClick={() => handleEditTest(test)}
                                        className="p-2 text-blue-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                        title="Edit Test"
                                    >
                                        <Icon name="edit" />
                                    </button>
                                    <button 
                                        onClick={() => handleDeleteTest(test.id)}
                                        className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                        title="Delete Test"
                                    >
                                        <Icon name="delete" />
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            )}

            {(view === 'create' || view === 'edit') && (
                <form onSubmit={handleCreateOrUpdateTest} className="space-y-6 max-w-2xl mx-auto">
                    <h3 className="text-lg font-bold text-slate-800 border-b pb-2 mb-4">
                        {editingTestId ? 'Edit Test' : 'Create New Test'}
                    </h3>
                    
                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">Test Title</label>
                        <input 
                            type="text" 
                            value={newTestTitle}
                            onChange={e => setNewTestTitle(e.target.value)}
                            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                            placeholder="e.g., TOEIC Mock Test Vol. 1"
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">Audio URL (MP3)</label>
                        <input 
                            type="url" 
                            value={newTestAudio}
                            onChange={e => setNewTestAudio(e.target.value)}
                            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                            placeholder="https://..."
                        />
                        <p className="text-xs text-slate-500 mt-1">Direct link to the MP3 file for the Listening section.</p>
                    </div>

                    {/* File Uploader Helper */}
                    <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
                        <h4 className="font-bold text-blue-800 text-sm mb-2 flex items-center gap-2">
                            <Icon name="cloud_upload" className="text-blue-600" /> 
                            File Uploader (Get Direct Link)
                        </h4>
                        <p className="text-xs text-blue-600 mb-3">
                            Upload images or MP3 files here to get a fast, direct link for your test.
                        </p>
                        
                        <div className="flex items-center gap-4">
                            <input 
                                type="file" 
                                onChange={handleFileUpload}
                                className="block w-full text-sm text-slate-500
                                    file:mr-4 file:py-2 file:px-4
                                    file:rounded-full file:border-0
                                    file:text-sm file:font-semibold
                                    file:bg-blue-100 file:text-blue-700
                                    hover:file:bg-blue-200
                                "
                            />
                        </div>

                        {uploading && (
                            <div className="mt-3">
                                <div className="w-full bg-blue-200 rounded-full h-2.5">
                                    <div className="bg-blue-600 h-2.5 rounded-full" style={{ width: `${uploadProgress}%` }}></div>
                                </div>
                                <p className="text-xs text-blue-600 mt-1 text-right">{Math.round(uploadProgress)}%</p>
                            </div>
                        )}

                        {uploadedUrl && (
                            <div className="mt-3 bg-white p-2 rounded border border-blue-200 flex items-center gap-2">
                                <input 
                                    type="text" 
                                    readOnly 
                                    value={uploadedUrl} 
                                    className="flex-1 text-xs text-slate-600 outline-none bg-transparent"
                                />
                                <button 
                                    type="button"
                                    onClick={() => copyToClipboard(uploadedUrl)}
                                    className="text-blue-600 hover:text-blue-800 text-xs font-bold"
                                >
                                    Copy
                                </button>
                            </div>
                        )}
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">
                            Questions Data (JSON Format)
                        </label>
                        <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 mb-2 text-xs text-slate-600 font-mono overflow-x-auto">
                            <p className="mb-2 font-bold">Template (Copy & Paste):</p>
                            <pre>{`[
  {
    "id": "d1",
    "part": 1,
    "type": "direction",
    "content": \`<div class='text-center mb-4'>
      <h3 class='font-bold text-lg'>LISTENING TEST</h3>
      <p class='text-sm text-gray-500'>In the Listening test...</p>
    </div>
    <div class='bg-gray-100 p-4 rounded-lg border border-gray-200 mb-6'>
      <h4 class='font-bold mb-2'>PART 1</h4>
      <p class='text-sm leading-relaxed mb-4'><strong>Directions:</strong> For each question...</p>
      <div class='flex justify-center mb-4'>
        <img src='https://placehold.co/600x400' class='h-48 rounded-lg border shadow-sm' />
      </div>
    </div>\`
  },
  {
    "id": "1",
    "part": 1,
    "correctAnswer": 0, 
    "imageUrl": "https://example.com/q1.jpg",
    "options": ["(A)", "(B)", "(C)", "(D)"]
  }
]`}</pre>
                        </div>
                        <textarea 
                            value={questionsInput}
                            onChange={e => setQuestionsInput(e.target.value)}
                            className="w-full h-96 px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none font-mono text-sm"
                            placeholder="Paste your data here (JS Object format allowed)..."
                            required
                        />
                    </div>

                    <div className="flex justify-end gap-3">
                        <button 
                            type="button"
                            onClick={() => { setView('list'); setEditingTestId(null); }}
                            className="px-6 py-2 text-slate-600 font-bold hover:bg-slate-100 rounded-lg"
                        >
                            Cancel
                        </button>
                        <button 
                            type="submit"
                            disabled={creating}
                            className="px-6 py-2 bg-primary hover:bg-blue-700 text-white font-bold rounded-lg shadow-lg shadow-primary/20 disabled:opacity-50"
                        >
                            {creating ? 'Saving...' : (editingTestId ? 'Update Test' : 'Create Test')}
                        </button>
                    </div>
                </form>
            )}

            {view === 'tickets' && (
                <div className="max-w-4xl mx-auto">
                    <div className="bg-slate-50 p-6 rounded-xl border border-slate-200 mb-8">
                        <h3 className="font-bold text-slate-800 mb-4">Generate Access Tickets</h3>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-2">Select Test</label>
                                <select 
                                    value={selectedTestId}
                                    onChange={e => setSelectedTestId(e.target.value)}
                                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary outline-none"
                                >
                                    <option value="">-- Select a Test --</option>
                                    {tests.map(t => (
                                        <option key={t.id} value={t.id}>{t.title}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-2">Quantity</label>
                                <input 
                                    type="number" 
                                    min="1" 
                                    max="100"
                                    value={ticketCount}
                                    onChange={e => setTicketCount(parseInt(e.target.value))}
                                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary outline-none"
                                />
                            </div>
                        </div>

                        <button 
                            onClick={handleGenerateTickets}
                            disabled={creating || !selectedTestId}
                            className="w-full py-3 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg shadow-lg shadow-green-600/20 disabled:opacity-50"
                        >
                            {creating ? 'Generating...' : 'Generate Tickets'}
                        </button>
                    </div>

                    {generatedCodes.length > 0 && (
                        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden mb-8 shadow-sm">
                            <div className="bg-green-50 px-6 py-3 border-b border-green-100 flex justify-between items-center">
                                <h3 className="font-bold text-green-800">New Tickets Generated!</h3>
                                <button 
                                    onClick={() => copyToClipboard(generatedCodes.join('\n'))}
                                    className="text-green-700 text-sm font-bold hover:underline"
                                >
                                    Copy All
                                </button>
                            </div>
                            <div className="max-h-64 overflow-y-auto p-4 bg-white font-mono text-sm grid grid-cols-2 md:grid-cols-4 gap-2">
                                {generatedCodes.map((code, idx) => (
                                    <div key={idx} className="flex justify-between items-center p-2 bg-slate-50 rounded border border-slate-100">
                                        <span className="text-slate-700 font-bold">{code}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
                            <h3 className="font-bold text-slate-800">All Tickets</h3>
                            <button onClick={loadTickets} className="text-primary text-sm hover:underline">Refresh</button>
                        </div>
                        
                        {loadingTickets ? (
                            <div className="p-8 text-center text-slate-400">Loading tickets...</div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-xs">
                                        <tr>
                                            <th className="px-6 py-3">Code</th>
                                            <th className="px-6 py-3">Status</th>
                                            <th className="px-6 py-3">Student</th>
                                            <th className="px-6 py-3">Test</th>
                                            <th className="px-6 py-3">Score (LC/RC)</th>
                                            <th className="px-6 py-3 text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {allTickets.map(ticket => {
                                            const result = results.find(r => r.ticketId === ticket.id);
                                            return (
                                            <tr key={ticket.id} className="hover:bg-slate-50">
                                                <td className="px-6 py-3 font-mono font-bold text-slate-700">{ticket.id}</td>
                                                <td className="px-6 py-3">
                                                    <span className={`px-2 py-1 rounded text-xs font-bold ${
                                                        ticket.status === 'Unused' ? 'bg-slate-100 text-slate-600' :
                                                        ticket.status === 'In-Progress' ? 'bg-yellow-100 text-yellow-700' :
                                                        'bg-green-100 text-green-700'
                                                    }`}>
                                                        {ticket.status}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-3 text-slate-600">
                                                    {ticket.studentName ? (
                                                        <div>
                                                            <div className="font-bold">{ticket.studentName}</div>
                                                            <div className="text-xs text-slate-400">{ticket.studentPhone}</div>
                                                        </div>
                                                    ) : '-'}
                                                </td>
                                                <td className="px-6 py-3 text-slate-500 text-xs">
                                                    {tests.find(t => t.id === ticket.testId)?.title || ticket.testId || '-'}
                                                </td>
                                                <td className="px-6 py-3 text-slate-600">
                                                    {result ? (
                                                        <div>
                                                            <div className="font-bold text-slate-800">Total: {result.totalScore}</div>
                                                            <div className="text-xs text-slate-500">
                                                                L: {result.lcScaledScore} / R: {result.rcScaledScore}
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <span className="text-slate-400">-</span>
                                                    )}
                                                </td>
                                                <td className="px-6 py-3 text-right flex justify-end gap-2">
                                                    {ticket.status !== 'Unused' && (
                                                        <button 
                                                            onClick={() => handleResetTicket(ticket.id)}
                                                            className="p-1 text-orange-400 hover:text-orange-600 hover:bg-orange-50 rounded"
                                                            title="Reset Ticket"
                                                        >
                                                            <Icon name="refresh" />
                                                        </button>
                                                    )}
                                                    <button 
                                                        onClick={() => handleDeleteTicket(ticket.id)}
                                                        className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded"
                                                        title="Delete Ticket"
                                                    >
                                                        <Icon name="delete" />
                                                    </button>
                                                </td>
                                            </tr>
                                            );
                                        })}
                                        {allTickets.length === 0 && (
                                            <tr>
                                                <td colSpan={5} className="px-6 py-8 text-center text-slate-400">
                                                    No tickets found.
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};
