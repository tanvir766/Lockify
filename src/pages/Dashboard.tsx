import React, { useState, useEffect } from 'react';
import { User as FirebaseUser } from 'firebase/auth';
import { get, set } from 'idb-keyval';
import { 
  Plus, 
  LogOut, 
  File, 
  Image as ImageIcon, 
  Video, 
  FileText, 
  Trash2, 
  Eye, 
  ShieldCheck,
  Search,
  ArrowLeft,
  Lock,
  MessageCircle
} from 'lucide-react';
import { authService } from '../services/authService';
import { fileService, userService } from '../services/fileService';
import { encryptionService } from '../services/encryptionService';
import { motion, AnimatePresence } from 'motion/react';
import { Link, useNavigate } from 'react-router-dom';

interface DashboardProps {
  user: FirebaseUser;
}

export default function Dashboard({ user }: DashboardProps) {
  const [files, setFiles] = useState<any[]>([]);
  const [unlockedFiles, setUnlockedFiles] = useState<any[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [activeTab, setActiveTab] = useState<'vault' | 'library'>('vault');
  const [searchQuery, setSearchQuery] = useState('');
  const [pin, setPin] = useState('');
  const [showPinModal, setShowPinModal] = useState(false);
  const [pinModalMode, setPinModalMode] = useState<'encrypt' | 'decrypt'>('encrypt');
  const [selectedFileForDecrypt, setSelectedFileForDecrypt] = useState<any>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [decryptedFile, setDecryptedFile] = useState<string | null>(null);
  const [previewMimeType, setPreviewMimeType] = useState<string | null>(null);
  const [isDecrypting, setIsDecrypting] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string>('');
  const [showFullPreview, setShowFullPreview] = useState<any>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    return () => {
      if (decryptedFile && decryptedFile.startsWith('blob:')) {
        URL.revokeObjectURL(decryptedFile);
      }
    };
  }, [decryptedFile]);

  useEffect(() => {
    const unsubscribe = fileService.getUserFiles(user.uid, setFiles);
    
    userService.getUserProfile(user.uid).then(profile => {
      if (profile?.role === 'admin' || user.email === 'mariaparvez100@gmail.com') setIsAdmin(true);
    });

    // Load library files from IndexedDB
    const loadLibrary = async () => {
      const storedFiles = await get(`media-library-${user.uid}`);
      if (storedFiles && Array.isArray(storedFiles)) {
        const filesWithPreviews = storedFiles.map(f => ({
          ...f,
          previewUrl: URL.createObjectURL(f.file)
        }));
        setUnlockedFiles(filesWithPreviews);
      } else {
        setUnlockedFiles([]);
      }
    };
    loadLibrary();

    // Prevent screenshots (CSS-based hint, actual prevention is limited in web)
    const style = document.createElement('style');
    style.innerHTML = `
      @media (max-width: 768px) {
        body { -webkit-user-select: none; -moz-user-select: none; -ms-user-select: none; user-select: none; }
      }
    `;
    document.head.appendChild(style);

    return () => {
      unsubscribe();
      document.head.removeChild(style);
      // Cleanup any remaining object URLs
      setUnlockedFiles(prev => {
        prev.forEach(f => {
          if (f.previewUrl) URL.revokeObjectURL(f.previewUrl);
        });
        return prev;
      });
    };
  }, [user.uid]);

  const saveLibraryToDB = async (files: any[]) => {
    const filesToStore = files.map(({ previewUrl, ...rest }) => rest);
    await set(`media-library-${user.uid}`, filesToStore);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // Create a local preview for the library
    const localUrl = URL.createObjectURL(file);
    const newFile = {
      id: Math.random().toString(36).substring(7),
      file,
      name: file.name,
      type: file.type,
      size: file.size,
      previewUrl: localUrl,
      addedAt: new Date()
    };
    
    const updatedLibrary = [newFile, ...unlockedFiles];
    setUnlockedFiles(updatedLibrary);
    saveLibraryToDB(updatedLibrary);
    
    setActiveTab('library');
    setIsMenuOpen(false);
    e.target.value = '';
  };

  const handleLockFromLibrary = (fileObj: any) => {
    setPendingFile(fileObj.file);
    setPinModalMode('encrypt');
    setShowPinModal(true);
    setShowFullPreview(null);
  };

  const removeFromFileLibrary = (id: string) => {
    setUnlockedFiles(prev => {
      const file = prev.find(f => f.id === id);
      if (file?.previewUrl) URL.revokeObjectURL(file.previewUrl);
      const updated = prev.filter(f => f.id !== id);
      saveLibraryToDB(updated);
      return updated;
    });
    if (showFullPreview?.id === id) setShowFullPreview(null);
  };

  const [uploadProgress, setUploadProgress] = useState<number>(0);

  const confirmUpload = async () => {
    console.log('[Dashboard] Confirming upload for:', pendingFile?.name);
    if (!pendingFile || !pin) {
      console.warn('[Dashboard] Missing file or PIN');
      return;
    }
    setIsUploading(true);
    setUploadStatus('Encrypting file...');
    try {
      console.log('[Dashboard] Starting encryption...');
      const { encryptedBlob, encryptedKey } = await encryptionService.encryptFile(pendingFile, pin);
      console.log('[Dashboard] Encryption successful. Blob size:', encryptedBlob.size);
      
      setUploadStatus('Uploading to secure vault...');
      const fileId = typeof crypto.randomUUID === 'function' 
        ? crypto.randomUUID() 
        : Math.random().toString(36).substring(2) + Date.now().toString(36);

      const metadata = {
        id: fileId,
        ownerId: user.uid,
        name: pendingFile.name,
        mimeType: pendingFile.type,
        size: pendingFile.size,
        encryptedKey
      };
      
      console.log('[Dashboard] Uploading to Firebase...');
      
      // We need to pass a callback to track progress if we want it in the UI
      // For now, let's just use the existing uploadFile and maybe add a progress listener there
      // Actually, I'll modify fileService.uploadFile to accept a progress callback
      const result = await fileService.uploadFile(encryptedBlob, metadata, (progress: number) => {
        setUploadProgress(progress);
      });

      if (result) {
        console.log('[Dashboard] Upload and metadata save successful');
        // Remove from library if it was there
        const updatedLibrary = unlockedFiles.filter(f => f.file !== pendingFile);
        setUnlockedFiles(updatedLibrary);
        saveLibraryToDB(updatedLibrary);
        
        setShowPinModal(false);
        setPin('');
        setPendingFile(null);
        setUploadStatus('');
        setUploadProgress(0);
        alert('File locked successfully!');
        setActiveTab('vault');
      } else {
        console.error('[Dashboard] Upload failed (no result)');
        alert('Upload failed. Please check your connection.');
      }
    } catch (err: any) {
      console.error('[Dashboard] Error in locking process:', err);
      alert(`Locking failed: ${err.message || 'Unknown error'}`);
    } finally {
      setIsUploading(false);
      setUploadStatus('');
      setUploadProgress(0);
    }
  };

  const handleViewFile = (file: any) => {
    setSelectedFileForDecrypt(file);
    setPinModalMode('decrypt');
    setShowPinModal(true);
  };

  const confirmDecrypt = async () => {
    if (!selectedFileForDecrypt || !pin) return;
    
    setIsDecrypting(true);
    setUploadStatus('Decrypting file...');
    try {
      console.log('[Dashboard] Downloading encrypted file...');
      const response = await fetch(selectedFileForDecrypt.downloadURL);
      const encryptedData = await response.arrayBuffer();
      console.log('[Dashboard] Download complete. Starting decryption...');
      const decryptedData = await encryptionService.decryptFile(encryptedData, selectedFileForDecrypt.encryptedKey, pin, selectedFileForDecrypt.mimeType);
      
      setPreviewMimeType(selectedFileForDecrypt.mimeType);
      setDecryptedFile(decryptedData);
      setShowPinModal(false);
      setPin('');
      setSelectedFileForDecrypt(null);
    } catch (err: any) {
      console.error('[Dashboard] Decryption failed:', err);
      alert(`Decryption failed: ${err.message || 'Invalid PIN or error'}`);
    } finally {
      setIsDecrypting(false);
      setUploadStatus('');
    }
  };

  const handleDeleteFile = async (file: any) => {
    if (confirm(`Are you sure you want to delete ${file.name}?`)) {
      await fileService.deleteFile(file.id, file.storagePath);
    }
  };

  const allFiles = [
    ...files.map(f => ({ ...f, isLocked: true })),
    ...unlockedFiles.map(f => ({ ...f, isLocked: false, mimeType: f.type }))
  ].sort((a, b) => {
    const dateA = a.createdAt?.toDate?.() || a.addedAt || new Date(0);
    const dateB = b.createdAt?.toDate?.() || b.addedAt || new Date(0);
    return dateB.getTime() - dateA.getTime();
  });

  const filteredAllFiles = allFiles.filter(f => f.name.toLowerCase().includes(searchQuery.toLowerCase()));

  const getFileIcon = (mime: string) => {
    if (mime.startsWith('image/')) return <ImageIcon className="text-indigo-500" />;
    if (mime.startsWith('video/')) return <Video className="text-red-500" />;
    if (mime.includes('pdf')) return <FileText className="text-orange-500" />;
    return <File className="text-blue-500" />;
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-8 h-8 text-blue-600" />
            <h1 className="text-xl font-bold text-gray-900">Lockify</h1>
          </div>
          <div className="flex items-center gap-4">
            {isAdmin && (
              <Link 
                to="/admin" 
                className="flex items-center gap-2 px-3 py-1.5 bg-indigo-50 text-indigo-700 rounded-lg text-xs font-bold hover:bg-indigo-100 transition-all border border-indigo-100"
              >
                <ShieldCheck className="w-4 h-4" />
                Admin Panel
              </Link>
            )}
            <button 
              onClick={() => authService.logout()}
              className="p-2 text-gray-500 hover:text-red-600 transition-colors"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8">
        {/* Search & Stats */}
        <div className="mb-8 flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="relative w-full md:w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input 
              type="text" 
              placeholder="Search your gallery..."
              className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="flex gap-4 text-sm font-medium">
            <span className="text-indigo-600 flex items-center gap-1">
              <ShieldCheck className="w-4 h-4" />
              {files.length} Locked
            </span>
            <span className="text-gray-400 flex items-center gap-1">
              <ImageIcon className="w-4 h-4" />
              {unlockedFiles.length} Unlocked
            </span>
          </div>
        </div>

        {/* Unified Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <AnimatePresence mode="popLayout">
            {filteredAllFiles.map((file) => (
              <motion.div
                key={file.id}
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                onClick={() => file.isLocked ? handleViewFile(file) : setShowFullPreview(file)}
                className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow group relative overflow-hidden cursor-pointer"
              >
                <div className="absolute top-2 right-2">
                  {file.isLocked && (
                    <div className="px-2 py-1 bg-indigo-50 text-indigo-600 text-[10px] font-bold rounded-md flex items-center gap-1">
                      <ShieldCheck className="w-3 h-3" />
                      LOCKED
                    </div>
                  )}
                </div>

                <div className="flex items-start justify-between mb-4">
                  <div className="p-3 bg-gray-50 rounded-xl">
                    {getFileIcon(file.mimeType)}
                  </div>
                  <div className="flex gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        file.isLocked ? handleViewFile(file) : setShowFullPreview(file);
                      }}
                      className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        file.isLocked ? handleDeleteFile(file) : removeFromFileLibrary(file.id);
                      }}
                      className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {file.previewUrl && (
                  <div className="aspect-video rounded-lg overflow-hidden mb-3 bg-gray-100">
                    <img src={file.previewUrl} alt={file.name} className="w-full h-full object-cover" />
                  </div>
                )}

                <h3 className="font-semibold text-gray-900 truncate mb-1">{file.name}</h3>
                <div className="flex items-center justify-between text-xs text-gray-400">
                  <span>{(file.size / 1024).toFixed(1)} KB</span>
                  <span>
                    {file.isLocked 
                      ? (file.createdAt?.toDate ? new Date(file.createdAt.toDate()).toLocaleDateString() : new Date(file.createdAt).toLocaleDateString())
                      : 'Added to library'}
                  </span>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {filteredAllFiles.length === 0 && (
            <div className="col-span-full py-20 text-center">
              <div className="bg-gray-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <Plus className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900">Your gallery is empty</h3>
              <p className="text-gray-500">Add files using the button below to get started</p>
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="max-w-5xl mx-auto px-4 py-8 text-center">
        <p className="text-xs text-gray-400">
          Secure AES-256 Encryption • Zero Knowledge Storage
        </p>
      </footer>

      {/* Floating Action Button Menu */}
      <div className="fixed bottom-8 right-8 flex flex-col items-end gap-4">
        <AnimatePresence>
          {isMenuOpen && (
            <div className="flex flex-col gap-3 mb-2">
              <motion.div
                initial={{ opacity: 0, y: 20, scale: 0.8 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 20, scale: 0.8 }}
                className="flex items-center gap-3"
              >
                <span className="bg-white px-3 py-1 rounded-lg shadow-sm text-sm font-medium text-gray-600 border border-gray-100">Video</span>
                <label className="bg-red-500 text-white p-3 rounded-full shadow-lg hover:bg-red-600 transition-all cursor-pointer">
                  <Video className="w-5 h-5" />
                  <input type="file" accept="video/*" className="sr-only" onChange={handleFileUpload} />
                </label>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20, scale: 0.8 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 20, scale: 0.8 }}
                transition={{ delay: 0.05 }}
                className="flex items-center gap-3"
              >
                <span className="bg-white px-3 py-1 rounded-lg shadow-sm text-sm font-medium text-gray-600 border border-gray-100">Image</span>
                <label className="bg-purple-500 text-white p-3 rounded-full shadow-lg hover:bg-purple-600 transition-all cursor-pointer">
                  <ImageIcon className="w-5 h-5" />
                  <input type="file" accept="image/*" className="sr-only" onChange={handleFileUpload} />
                </label>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20, scale: 0.8 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 20, scale: 0.8 }}
                transition={{ delay: 0.1 }}
                className="flex items-center gap-3"
              >
                <span className="bg-white px-3 py-1 rounded-lg shadow-sm text-sm font-medium text-gray-600 border border-gray-100">File</span>
                <label className="bg-blue-500 text-white p-3 rounded-full shadow-lg hover:bg-blue-600 transition-all cursor-pointer">
                  <File className="w-5 h-5" />
                  <input type="file" className="sr-only" onChange={handleFileUpload} />
                </label>
              </motion.div>

              {isAdmin && (
                <motion.div
                  initial={{ opacity: 0, y: 20, scale: 0.8 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 20, scale: 0.8 }}
                  transition={{ delay: 0.15 }}
                  className="flex items-center gap-3"
                >
                  <span className="bg-white px-3 py-1 rounded-lg shadow-sm text-sm font-medium text-indigo-600 border border-indigo-100">Admin</span>
                  <button 
                    onClick={() => navigate('/admin')}
                    className="bg-indigo-600 text-white p-3 rounded-full shadow-lg hover:bg-indigo-700 transition-all"
                  >
                    <ShieldCheck className="w-5 h-5" />
                  </button>
                </motion.div>
              )}

              <motion.div
                initial={{ opacity: 0, y: 20, scale: 0.8 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 20, scale: 0.8 }}
                transition={{ delay: 0.2 }}
                className="flex items-center gap-3"
              >
                <span className="bg-white px-3 py-1 rounded-lg shadow-sm text-sm font-medium text-green-600 border border-green-100">Support</span>
                <a 
                  href="https://wa.me/1234567890"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-green-500 text-white p-3 rounded-full shadow-lg hover:bg-green-600 transition-all"
                >
                  <MessageCircle className="w-5 h-5" />
                </a>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        <button 
          onClick={() => setIsMenuOpen(!isMenuOpen)}
          className={`p-4 rounded-full shadow-xl transition-all duration-300 flex items-center justify-center ${isMenuOpen ? 'bg-gray-800 text-white rotate-45' : 'bg-blue-600 text-white'}`}
        >
          <Plus className="w-6 h-6" />
        </button>
      </div>

      {/* PIN Modal */}
      <AnimatePresence>
        {showPinModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl"
            >
              <div className="flex items-center justify-center w-12 h-12 mx-auto mb-4 bg-indigo-100 rounded-full">
                <ShieldCheck className="w-6 h-6 text-indigo-600" />
              </div>
              <h3 className="text-xl font-bold text-center text-gray-900 mb-2">
                {pinModalMode === 'encrypt' ? 'Set Encryption PIN' : 'Enter PIN to Unlock'}
              </h3>
              <p className="text-sm text-center text-gray-500 mb-6">
                {pinModalMode === 'encrypt' 
                  ? 'This PIN will be required to decrypt and view this file later. Do not forget it.'
                  : 'Please enter the PIN you set when locking this file.'}
              </p>

              {uploadStatus && (
                <div className="mb-4 text-center">
                  <div className="text-indigo-600 font-medium animate-pulse">
                    {uploadStatus} {isUploading && uploadProgress > 0 && uploadProgress < 100 && `(${Math.round(uploadProgress)}%)`}
                  </div>
                  {isUploading && uploadProgress > 0 && uploadProgress < 100 && (
                    <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                      <div 
                        className="bg-indigo-600 h-2 rounded-full transition-all duration-300" 
                        style={{ width: `${uploadProgress}%` }}
                      />
                    </div>
                  )}
                </div>
              )}
              
              <div className="space-y-4">
                <input
                  type="password"
                  inputMode="numeric"
                  placeholder="Enter 4-6 digit PIN"
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  className="w-full px-4 py-3 text-center text-2xl tracking-widest border-2 border-gray-100 rounded-xl focus:border-indigo-500 focus:outline-none transition-colors"
                  autoFocus
                />
                
                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setShowPinModal(false);
                      setPin('');
                      setPendingFile(null);
                      setSelectedFileForDecrypt(null);
                    }}
                    className="flex-1 px-4 py-3 text-gray-600 font-medium bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={pinModalMode === 'encrypt' ? confirmUpload : confirmDecrypt}
                    disabled={pin.length < 4 || isUploading || isDecrypting}
                    className="flex-1 px-4 py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-indigo-200 flex items-center justify-center gap-2"
                  >
                    {(isUploading || isDecrypting) ? (
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <>
                        <ShieldCheck className="w-5 h-5" />
                        {pinModalMode === 'encrypt' ? 'Lock File' : 'Unlock Now'}
                      </>
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Full Screen Preview Modal */}
      <AnimatePresence>
        {showFullPreview && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] bg-black flex flex-col"
          >
            <div className="p-4 flex items-center justify-between bg-black/50 backdrop-blur-md">
              <button 
                onClick={() => setShowFullPreview(null)}
                className="p-2 text-white hover:bg-white/10 rounded-full transition-all"
              >
                <ArrowLeft className="w-6 h-6" />
              </button>
              <div className="flex-1 px-4">
                <h3 className="text-white font-semibold truncate">{showFullPreview.name}</h3>
                <p className="text-gray-400 text-xs">{(showFullPreview.size / 1024).toFixed(1)} KB</p>
              </div>
              <div className="flex gap-2">
                <button 
                  onClick={() => handleLockFromLibrary(showFullPreview)}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-xl font-bold flex items-center gap-2 hover:bg-indigo-700 transition-all"
                >
                  <ShieldCheck className="w-5 h-5" />
                  Lock File
                </button>
                <button 
                  onClick={() => removeFromFileLibrary(showFullPreview.id)}
                  className="p-2 text-white hover:bg-red-600 rounded-xl transition-all"
                >
                  <Trash2 className="w-6 h-6" />
                </button>
              </div>
            </div>
            
            <div className="flex-1 flex items-center justify-center p-4 overflow-auto">
              {showFullPreview.type.startsWith('image/') ? (
                <img 
                  src={showFullPreview.previewUrl} 
                  alt={showFullPreview.name} 
                  className="max-w-full max-h-full object-contain"
                />
              ) : showFullPreview.type.startsWith('video/') ? (
                <video 
                  src={showFullPreview.previewUrl} 
                  controls 
                  className="max-w-full max-h-full"
                />
              ) : (
                <div className="text-center text-white">
                  <div className="p-8 bg-white/10 rounded-3xl mb-4 inline-block">
                    {getFileIcon(showFullPreview.type)}
                  </div>
                  <p className="text-xl font-semibold">Preview not available for this file type</p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {decryptedFile && (
          <div className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center z-50 p-4">
            <div className="max-w-4xl w-full max-h-[90vh] flex flex-col">
              <div className="flex justify-end mb-4">
                <button 
                  onClick={() => setDecryptedFile(null)}
                  className="text-white hover:text-gray-300 p-2"
                >
                  <Plus className="w-8 h-8 rotate-45" />
                </button>
              </div>
              <div className="bg-white rounded-2xl overflow-hidden flex-1 flex items-center justify-center p-4">
                {previewMimeType?.startsWith('image/') ? (
                  <img src={decryptedFile} alt="Preview" className="max-w-full max-h-full object-contain" referrerPolicy="no-referrer" />
                ) : previewMimeType?.startsWith('video/') ? (
                  <video src={decryptedFile} controls autoPlay className="max-w-full max-h-full" />
                ) : (
                  <div className="text-center p-8">
                    <File className="w-20 h-20 mx-auto mb-4 text-indigo-400" />
                    <p className="text-xl font-medium mb-4">Document Decrypted</p>
                    <a 
                      href={decryptedFile} 
                      download="decrypted_file"
                      className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-colors"
                    >
                      <Plus className="w-5 h-5" />
                      Download File
                    </a>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* Decrypting Loader */}
      {isDecrypting && (
        <div className="fixed inset-0 bg-white/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mx-auto mb-4"></div>
            <p className="font-semibold text-gray-700">Decrypting your file...</p>
          </div>
        </div>
      )}
    </div>
  );
}
