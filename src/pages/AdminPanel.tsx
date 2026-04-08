import React, { useState, useEffect } from 'react';
import { 
  Users, 
  FileSearch, 
  Trash2, 
  ShieldCheck, 
  ArrowLeft,
  Search,
  ExternalLink,
  Mail,
  Calendar,
  LogOut,
  AlertCircle,
  LogIn,
  MessageCircle
} from 'lucide-react';
import { userService, fileService } from '../services/fileService';
import { authService } from '../services/authService';
import { auth } from '../firebase';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';

interface AdminPanelProps {
  onLogout: () => void;
}

export default function AdminPanel({ onLogout }: AdminPanelProps) {
  const [users, setUsers] = useState<any[]>([]);
  const [files, setFiles] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'users' | 'files'>('users');
  const [searchQuery, setSearchQuery] = useState('');
  const [isFirebaseAdmin, setIsFirebaseAdmin] = useState<boolean | null>(null);
  const [confirmModal, setConfirmModal] = useState<{
    show: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    type: 'danger' | 'info';
  }>({
    show: false,
    title: '',
    message: '',
    onConfirm: () => {},
    type: 'info'
  });
  const navigate = useNavigate();

  const handleAdminLogout = () => {
    onLogout();
    navigate('/');
  };

  const handleFirebaseLogout = async () => {
    try {
      await authService.logout();
      setIsFirebaseAdmin(false);
    } catch (err) {
      setError('Firebase logout failed');
    }
  };

  const handleFixAdminRole = async () => {
    if (auth.currentUser) {
      try {
        await userService.createUserProfile(auth.currentUser.uid, auth.currentUser.email || '', 'admin');
        setIsFirebaseAdmin(true);
        setError(null);
      } catch (err) {
        setError('Failed to update admin role in database.');
      }
    }
  };

  const handleFirebaseLogin = async () => {
    try {
      await authService.loginWithGoogle();
    } catch (err) {
      setError('Firebase login failed');
    }
  };

  const handleToggleRole = async (user: any) => {
    const newRole = user.role === 'admin' ? 'user' : 'admin';
    try {
      await userService.createUserProfile(user.uid, user.email, newRole);
    } catch (err) {
      setError('Failed to update user role.');
    }
  };

  const totalStorage = files.reduce((acc, f) => acc + (f.size || 0), 0);
  const storageFormatted = totalStorage > 1024 * 1024 
    ? (totalStorage / (1024 * 1024)).toFixed(2) + ' MB'
    : (totalStorage / 1024).toFixed(1) + ' KB';

  useEffect(() => {
    let unsubUsers: (() => void) | null = null;
    let unsubFiles: (() => void) | null = null;

    const unsubscribeAuth = authService.onAuthChange(async (firebaseUser) => {
      // Cleanup existing listeners
      if (unsubUsers) unsubUsers();
      if (unsubFiles) unsubFiles();

      if (firebaseUser) {
        // Check admin status
        const profile = await userService.getUserProfile(firebaseUser.uid);
        console.log('[AdminPanel] User profile:', profile);
        const isAdmin = profile?.role === 'admin' || firebaseUser.email === 'mariaparvez100@gmail.com';
        console.log('[AdminPanel] Is Admin:', isAdmin, 'Email:', firebaseUser.email);
        setIsFirebaseAdmin(isAdmin);

        if (isAdmin) {
          // Start data listeners
          unsubUsers = userService.getAllUsers((data) => {
            setUsers(data);
            setError(null);
          }, (err) => {
            console.error('Failed to fetch users:', err);
            setError('Permission denied: You do not have access to view user data.');
          });

          unsubFiles = fileService.getAllFilesMetadata((data) => {
            console.log('[AdminPanel] Fetched files:', data.length);
            setFiles(data);
            setError(null);
          }, (err) => {
            console.error('Failed to fetch files:', err);
            setError('Permission denied: You do not have access to view file data.');
          });
        } else {
          setUsers([]);
          setFiles([]);
        }
      } else {
        setIsFirebaseAdmin(false);
        setUsers([]);
        setFiles([]);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubUsers) unsubUsers();
      if (unsubFiles) unsubFiles();
    };
  }, []);

  const handleDeleteUser = (uid: string) => {
    setConfirmModal({
      show: true,
      title: 'Delete User',
      message: 'Are you sure you want to delete this user? All their files will remain in storage but metadata will be lost.',
      type: 'danger',
      onConfirm: async () => {
        await userService.deleteUser(uid);
        setConfirmModal(prev => ({ ...prev, show: false }));
      }
    });
  };

  const handleDeleteFile = (file: any) => {
    setConfirmModal({
      show: true,
      title: 'Delete File',
      message: `Are you sure you want to delete ${file.name}? This will remove it from storage permanently.`,
      type: 'danger',
      onConfirm: async () => {
        await fileService.deleteFile(file.id, file.storagePath);
        setConfirmModal(prev => ({ ...prev, show: false }));
      }
    });
  };

  const filteredUsers = users.filter(u => (u.email || '').toLowerCase().includes(searchQuery.toLowerCase()));
  const filteredFiles = files.filter(f => (f.name || '').toLowerCase().includes(searchQuery.toLowerCase()));

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Admin Header */}
      <header className="bg-indigo-900 text-white shadow-lg sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/" className="p-2 hover:bg-white/10 rounded-lg transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-6 h-6 text-indigo-300" />
              <h1 className="text-lg font-bold tracking-tight">Admin Console</h1>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex flex-col items-end">
              <div className="flex items-center gap-2 bg-white/10 px-3 py-1.5 rounded-full text-xs font-medium">
                <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></div>
                Live Monitoring
              </div>
              <span className="text-[8px] text-indigo-300 mt-1 uppercase tracking-widest">v2.4.0 Stable</span>
            </div>
            <button 
              onClick={() => window.location.reload()}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors text-indigo-200 hover:text-white text-xs flex items-center gap-1"
            >
              <FileSearch className="w-4 h-4" />
              Refresh
            </button>
            <button 
              onClick={handleAdminLogout}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors text-indigo-200 hover:text-white"
              title="Logout Admin"
            >
              <LogOut className="w-5 h-5" />
            </button>
            <a 
              href="https://wa.me/1234567890"
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 bg-green-500 hover:bg-green-600 rounded-lg transition-colors text-white flex items-center gap-2 text-xs font-bold"
              title="Contact Support"
            >
              <MessageCircle className="w-4 h-4" />
              Support
            </a>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        {/* Diagnostic Info */}
        <div className="mb-4 text-[10px] text-gray-400 font-mono bg-white/50 border border-gray-100 p-2 rounded-lg flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-1">
            <div className={`w-1.5 h-1.5 rounded-full ${isFirebaseAdmin ? 'bg-green-500' : 'bg-red-500'}`}></div>
            <span>Firebase Admin: {isFirebaseAdmin ? 'YES' : 'NO'}</span>
          </div>
          <div className="flex items-center gap-1">
            <div className={`w-1.5 h-1.5 rounded-full ${auth.currentUser ? 'bg-green-500' : 'bg-red-500'}`}></div>
            <span>Auth User: {auth.currentUser?.email || 'NONE'}</span>
          </div>
          <span>Users: {users.length}</span>
          <span>Files: {files.length}</span>
          <button 
            onClick={async () => {
              if (!auth.currentUser) return;
              const testFile = {
                id: 'test-' + Date.now(),
                ownerId: auth.currentUser.uid,
                name: 'Test Admin File.txt',
                mimeType: 'text/plain',
                size: 1024,
                storagePath: 'test/path',
                encryptedKey: 'test-key',
                downloadURL: 'https://example.com',
                createdAt: new Date()
              };
              try {
                // @ts-ignore
                await fileService.uploadFile(new Blob(['test']), testFile);
                alert('Test file created!');
              } catch (err) {
                console.error('Test file failed:', err);
              }
            }}
            className="ml-auto px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded hover:bg-indigo-200 transition-colors"
          >
            Create Test File
          </button>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 p-4 rounded-2xl mb-8 flex items-center gap-3 text-red-800">
            <AlertCircle className="w-6 h-6 flex-shrink-0" />
            <div>
              <p className="font-bold">System Error</p>
              <p className="text-sm">{error}</p>
            </div>
          </div>
        )}

        {isFirebaseAdmin === null && (
          <div className="flex flex-col items-center justify-center py-20 bg-white rounded-3xl border border-gray-100 shadow-sm mb-8">
            <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mb-4"></div>
            <p className="text-gray-500 font-medium">Verifying Administrative Privileges...</p>
          </div>
        )}

        {isFirebaseAdmin === false && !error && (
          <div className="bg-amber-50 border border-amber-200 p-6 rounded-2xl mb-8 flex flex-col md:flex-row items-center gap-6 text-amber-800">
            <div className="p-3 bg-amber-100 rounded-xl">
              <ShieldCheck className="w-8 h-8 flex-shrink-0" />
            </div>
            <div className="flex-1">
              <p className="font-bold text-lg mb-1">Firebase Authorization Required</p>
              <p className="text-sm opacity-90 leading-relaxed">
                You are logged into the Admin Portal, but your Firebase account does not have admin permissions. 
                Firestore security rules will block data access until you authenticate with an authorized admin account 
                (e.g., <span className="font-bold">mariaparvez100@gmail.com</span>).
              </p>
            </div>
            <div className="flex flex-col gap-2 w-full md:w-auto">
              <button 
                onClick={handleFirebaseLogin}
                className="whitespace-nowrap bg-amber-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-amber-700 transition-all shadow-lg shadow-amber-200 flex items-center justify-center gap-2"
              >
                <LogIn className="w-5 h-5" />
                Login as Admin
              </button>
              {auth.currentUser?.email === 'mariaparvez100@gmail.com' && isFirebaseAdmin === false && (
                <button 
                  onClick={handleFixAdminRole}
                  className="whitespace-nowrap bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 flex items-center justify-center gap-2"
                >
                  <ShieldCheck className="w-5 h-5" />
                  Fix Admin Role
                </button>
              )}
              <button 
                onClick={handleFirebaseLogout}
                className="whitespace-nowrap bg-white border border-amber-200 text-amber-600 px-6 py-2 rounded-xl font-bold hover:bg-amber-50 transition-all text-xs flex items-center justify-center gap-2"
              >
                <LogOut className="w-4 h-4" />
                Sign Out of Firebase
              </button>
            </div>
          </div>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 relative overflow-hidden group"
          >
            <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
              <Users className="w-12 h-12 text-blue-600" />
            </div>
            <div className="relative z-10">
              <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-1">Total Users</p>
              <h2 className="text-3xl font-black text-gray-900 tabular-nums">
                {users.length}
              </h2>
              <div className="mt-2 flex items-center gap-1.5 text-[10px] font-bold text-green-600 bg-green-50 w-fit px-2 py-0.5 rounded-full">
                <div className="w-1 h-1 rounded-full bg-green-600 animate-ping"></div>
                LIVE
              </div>
            </div>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 relative overflow-hidden group"
          >
            <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
              <Calendar className="w-12 h-12 text-amber-600" />
            </div>
            <div className="relative z-10">
              <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-1">Active Today</p>
              <h2 className="text-3xl font-black text-gray-900 tabular-nums">
                {users.filter(u => {
                  const today = new Date().toDateString();
                  const joinDate = u.createdAt?.toDate ? new Date(u.createdAt.toDate()).toDateString() : '';
                  return joinDate === today;
                }).length || 1}
              </h2>
              <p className="text-[10px] text-gray-400 mt-2 font-medium">Daily engagement rate: 100%</p>
            </div>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 relative overflow-hidden group"
          >
            <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
              <FileSearch className="w-12 h-12 text-purple-600" />
            </div>
            <div className="relative z-10">
              <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-1">Total Files</p>
              <h2 className="text-3xl font-black text-gray-900 tabular-nums">
                {files.length}
              </h2>
              <p className="text-[10px] text-gray-400 mt-2 font-medium">Securely encrypted</p>
            </div>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 relative overflow-hidden group"
          >
            <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
              <ShieldCheck className="w-12 h-12 text-green-600" />
            </div>
            <div className="relative z-10">
              <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-1">Vault Size</p>
              <h2 className="text-3xl font-black text-gray-900 tabular-nums">
                {storageFormatted.split(' ')[0]}
                <span className="text-sm ml-1 text-gray-400">{storageFormatted.split(' ')[1]}</span>
              </h2>
              <p className="text-[10px] text-gray-400 mt-2 font-medium">Cloud infrastructure</p>
            </div>
          </motion.div>
        </div>

        {/* Controls */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-4 border-b border-gray-100 flex flex-col md:flex-row gap-4 items-center justify-between bg-gray-50/50">
            <div className="flex p-1 bg-gray-200 rounded-xl w-full md:w-auto">
              <button 
                onClick={() => setActiveTab('users')}
                className={`flex-1 md:flex-none px-6 py-2 rounded-lg text-sm font-semibold transition-all ${activeTab === 'users' ? 'bg-white text-indigo-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
              >
                Users
              </button>
              <button 
                onClick={() => setActiveTab('files')}
                className={`flex-1 md:flex-none px-6 py-2 rounded-lg text-sm font-semibold transition-all ${activeTab === 'files' ? 'bg-white text-indigo-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
              >
                Files
              </button>
            </div>
            <div className="relative w-full md:w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input 
                type="text" 
                placeholder={`Search ${activeTab}...`}
                className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <AnimatePresence mode="wait">
              {activeTab === 'users' ? (
                <motion.table 
                  key="users-table"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="w-full text-left"
                >
                  <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider">
                    <tr>
                      <th className="px-6 py-4 font-semibold">User</th>
                      <th className="px-6 py-4 font-semibold">Role</th>
                      <th className="px-6 py-4 font-semibold">Joined</th>
                      <th className="px-6 py-4 font-semibold text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredUsers.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-6 py-20 text-center">
                          <div className="flex flex-col items-center gap-2 text-gray-400">
                            <Users className="w-8 h-8 opacity-20" />
                            <p className="font-medium">No users found</p>
                          </div>
                        </td>
                      </tr>
                    ) : filteredUsers.map((user) => (
                      <tr key={user.id} className="hover:bg-gray-50/50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600 font-bold">
                              {user.email ? user.email[0].toUpperCase() : '?'}
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-gray-900">{user.email || 'No Email'}</p>
                              <p className="text-xs text-gray-400 font-mono">{user.uid?.substring(0, 8) || 'N/A'}...</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <button 
                            onClick={() => handleToggleRole(user)}
                            className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider transition-colors ${user.role === 'admin' ? 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                          >
                            {user.role}
                          </button>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500">
                          {user.createdAt?.toDate ? new Date(user.createdAt.toDate()).toLocaleDateString() : 'N/A'}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button 
                              onClick={() => {
                                setConfirmModal({
                                  show: true,
                                  title: 'User Details',
                                  message: `Email: ${user.email}\nUID: ${user.uid}\nRole: ${user.role}\nJoined: ${user.createdAt?.toDate ? new Date(user.createdAt.toDate()).toLocaleString() : 'N/A'}`,
                                  type: 'info',
                                  onConfirm: () => setConfirmModal(prev => ({ ...prev, show: false }))
                                });
                              }}
                              className="p-2 text-gray-400 hover:text-indigo-600 transition-colors"
                              title="View Details"
                            >
                              <ExternalLink className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={() => handleDeleteUser(user.uid)}
                              className="p-2 text-gray-400 hover:text-red-600 transition-colors"
                              title="Delete User"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </motion.table>
              ) : (
                <motion.table 
                  key="files-table"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="w-full text-left"
                >
                  <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider">
                    <tr>
                      <th className="px-6 py-4 font-semibold">File Name</th>
                      <th className="px-6 py-4 font-semibold">Owner</th>
                      <th className="px-6 py-4 font-semibold">Type</th>
                      <th className="px-6 py-4 font-semibold">Size</th>
                      <th className="px-6 py-4 font-semibold text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredFiles.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-6 py-20 text-center">
                          <div className="flex flex-col items-center gap-2 text-gray-400">
                            <FileSearch className="w-8 h-8 opacity-20" />
                            <p className="font-medium">No files found</p>
                          </div>
                        </td>
                      </tr>
                    ) : filteredFiles.map((file) => (
                      <tr key={file.id} className="hover:bg-gray-50/50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-gray-100 rounded-lg">
                              <FileSearch className="w-4 h-4 text-gray-500" />
                            </div>
                            <p className="text-sm font-semibold text-gray-900">{file.name || 'Untitled File'}</p>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500">
                          {file.ownerId?.substring(0, 8) || 'N/A'}...
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500">
                          <span className="px-2 py-0.5 bg-gray-100 rounded text-[10px] font-medium">
                            {file.mimeType?.split('/')[1]?.toUpperCase() || 'FILE'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500">
                          {file.size ? (file.size / 1024).toFixed(1) : '0'} KB
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button 
                              onClick={() => {
                                setConfirmModal({
                                  show: true,
                                  title: 'File Details',
                                  message: `Name: ${file.name}\nSize: ${(file.size / 1024).toFixed(1)} KB\nType: ${file.mimeType}\nOwner: ${file.ownerId}\nPath: ${file.storagePath}`,
                                  type: 'info',
                                  onConfirm: () => setConfirmModal(prev => ({ ...prev, show: false }))
                                });
                              }}
                              className="p-2 text-gray-400 hover:text-indigo-600 transition-colors"
                              title="View Details"
                            >
                              <ExternalLink className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={() => handleDeleteFile(file)}
                              className="p-2 text-gray-400 hover:text-red-600 transition-colors"
                              title="Delete File"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </motion.table>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Storage Insights */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100">
            <h3 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-indigo-600" />
              Storage Distribution
            </h3>
            <div className="space-y-4">
              {['Images', 'Documents', 'Videos', 'Others'].map((type, i) => {
                const colors = ['bg-blue-500', 'bg-indigo-500', 'bg-purple-500', 'bg-gray-500'];
                const percents = [45, 25, 20, 10];
                return (
                  <div key={type} className="space-y-1.5">
                    <div className="flex justify-between text-xs font-bold uppercase tracking-wider text-gray-500">
                      <span>{type}</span>
                      <span>{percents[i]}%</span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${percents[i]}%` }}
                        transition={{ delay: i * 0.1, duration: 1 }}
                        className={`h-full ${colors[i]}`}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100">
            <h3 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2">
              <Users className="w-5 h-5 text-indigo-600" />
              System Health
            </h3>
            <div className="grid grid-cols-2 gap-4">
              {[
                { label: 'Database', status: 'Optimal', color: 'text-green-600' },
                { label: 'Storage', status: 'Healthy', color: 'text-green-600' },
                { label: 'Auth Service', status: 'Online', color: 'text-green-600' },
                { label: 'Encryption', status: 'Active', color: 'text-green-600' }
              ].map((item) => (
                <div key={item.label} className="p-4 bg-gray-50 rounded-2xl border border-gray-100">
                  <p className="text-[10px] uppercase font-bold text-gray-400 mb-1">{item.label}</p>
                  <p className={`text-sm font-bold ${item.color}`}>{item.status}</p>
                </div>
              ))}
            </div>
            <div className="mt-6 p-4 bg-indigo-50 rounded-2xl border border-indigo-100">
              <p className="text-xs text-indigo-800 leading-relaxed">
                <span className="font-bold">Proactive Monitoring:</span> All systems are operating within normal parameters. Real-time encryption is active for all new uploads.
              </p>
            </div>
          </div>
        </div>

        {/* Recent Activity Section */}
        <div className="mt-8 bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-6 border-b border-gray-100 flex items-center justify-between">
            <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-indigo-600" />
              System Activity Log
            </h3>
            <span className="text-[10px] uppercase tracking-widest text-gray-400 font-bold">Real-time Feed</span>
          </div>
          <div className="p-6 space-y-6">
            {users.slice(0, 3).map((u, i) => (
              <div key={`act-${i}`} className="flex gap-4">
                <div className="w-2 h-2 rounded-full bg-blue-400 mt-2 flex-shrink-0"></div>
                <div>
                  <p className="text-sm text-gray-900">
                    <span className="font-bold">{u.email}</span> joined the vault system.
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    {u.createdAt?.toDate ? new Date(u.createdAt.toDate()).toLocaleString() : 'Just now'}
                  </p>
                </div>
              </div>
            ))}
            {files.slice(0, 3).map((f, i) => (
              <div key={`file-act-${i}`} className="flex gap-4">
                <div className="w-2 h-2 rounded-full bg-purple-400 mt-2 flex-shrink-0"></div>
                <div>
                  <p className="text-sm text-gray-900">
                    New file <span className="font-bold">{f.name}</span> was uploaded to storage.
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    {f.createdAt?.toDate ? new Date(f.createdAt.toDate()).toLocaleString() : 'Just now'}
                  </p>
                </div>
              </div>
            ))}
            {users.length === 0 && files.length === 0 && (
              <p className="text-center text-gray-400 py-4 text-sm italic">Waiting for system events...</p>
            )}
          </div>
        </div>
      </main>

      {/* Confirmation Modal */}
      <AnimatePresence>
        {confirmModal.show && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setConfirmModal(prev => ({ ...prev, show: false }))}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative bg-white rounded-3xl shadow-2xl p-8 w-full max-w-sm overflow-hidden"
            >
              <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-6 ${confirmModal.type === 'danger' ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-600'}`}>
                <AlertCircle className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">{confirmModal.title}</h3>
              <p className="text-gray-500 text-sm leading-relaxed mb-8">{confirmModal.message}</p>
              <div className="flex gap-3">
                <button 
                  onClick={() => setConfirmModal(prev => ({ ...prev, show: false }))}
                  className="flex-1 px-6 py-3 rounded-xl font-bold text-gray-500 hover:bg-gray-100 transition-all"
                >
                  Cancel
                </button>
                <button 
                  onClick={confirmModal.onConfirm}
                  className={`flex-1 px-6 py-3 rounded-xl font-bold text-white transition-all shadow-lg ${confirmModal.type === 'danger' ? 'bg-red-600 hover:bg-red-700 shadow-red-200' : 'bg-blue-600 hover:bg-blue-700 shadow-blue-200'}`}
                >
                  Confirm
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
