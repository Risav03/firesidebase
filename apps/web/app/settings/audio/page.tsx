'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { toast } from 'react-toastify';
import sdk from '@farcaster/miniapp-sdk';
import { IoIosArrowBack } from 'react-icons/io';
import { Upload, Trash2, Play, Pause, RefreshCw } from 'lucide-react';
import { useGlobalContext } from '@/utils/providers/globalContext';
import NavigationWrapper from '@/components/NavigationWrapper';
import MainHeader from '@/components/UI/MainHeader';
import { Card } from '@/components/UI/Card';
import Button from '@/components/UI/Button';
import { getIntroOutroAudio, deleteIntroOutroAudio } from '@/utils/serverActions';

type Kind = 'intro' | 'outro';

const MAX_AUDIO_BYTES = 10 * 1024 * 1024; // 10 MB

async function buildAuthToken(): Promise<string | null> {
  const env = process.env.NEXT_PUBLIC_ENV;
  if (env === 'DEV') return 'dev';
  const tokenResponse = await sdk.quickAuth.getToken();
  return tokenResponse?.token || null;
}

function formatBytes(bytes: number): string {
  if (!bytes) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function AudioUploadCard({
  kind,
  title,
  description,
  url,
  busy,
  onUpload,
  onDelete,
}: {
  kind: Kind;
  title: string;
  description: string;
  url: string | null;
  busy: boolean;
  onUpload: (kind: Kind, file: File) => Promise<void>;
  onDelete: (kind: Kind) => Promise<void>;
}) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    setIsPlaying(false);
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
  }, [url]);

  const handlePick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('audio/')) {
      toast.error('Please select an audio file');
      return;
    }
    if (file.size > MAX_AUDIO_BYTES) {
      toast.error(`File is too large (max ${formatBytes(MAX_AUDIO_BYTES)})`);
      return;
    }
    await onUpload(kind, file);
  };

  const togglePreview = () => {
    if (!audioRef.current) return;
    if (audioRef.current.paused) {
      audioRef.current.play().catch(() => {});
      setIsPlaying(true);
    } else {
      audioRef.current.pause();
      setIsPlaying(false);
    }
  };

  return (
    <Card variant="ghost" className="p-4 bg-fireside-orange/10 border border-fireside-orange/30 rounded-xl">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 text-left">
          <p className="text-white font-semibold">{title}</p>
          <p className="text-white/70 text-sm">{description}</p>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="audio/*"
        className="hidden"
        onChange={handleFileChange}
      />

      {url ? (
        <div className="mt-4 space-y-3">
          <div className="flex items-center gap-2 rounded-lg bg-black/30 border border-white/10 p-3">
            <button
              type="button"
              onClick={togglePreview}
              className="grid h-9 w-9 place-items-center rounded-full bg-fireside-orange text-white disabled:opacity-50"
              disabled={busy}
              aria-label={isPlaying ? 'Pause preview' : 'Play preview'}
            >
              {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            </button>
            <div className="flex-1 min-w-0">
              <p className="text-white text-sm truncate">Current {kind} audio</p>
              <p className="text-white/50 text-xs truncate">{url}</p>
            </div>
          </div>
          <audio
            ref={audioRef}
            src={url}
            onEnded={() => setIsPlaying(false)}
            onPause={() => setIsPlaying(false)}
            preload="metadata"
          />
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handlePick}
              disabled={busy}
              className="flex-1"
            >
              <RefreshCw className="inline mr-2 h-4 w-4" />
              Replace
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onDelete(kind)}
              disabled={busy}
              className="flex-1"
            >
              <Trash2 className="inline mr-2 h-4 w-4" />
              Remove
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-4">
          <Button
            variant="default"
            size="md"
            onClick={handlePick}
            disabled={busy}
            className="w-full"
          >
            <Upload className="inline mr-2 h-4 w-4" />
            Upload {kind} audio
          </Button>
          <p className="text-white/50 text-xs mt-2 text-center">
            MP3, WAV, OGG &mdash; up to {formatBytes(MAX_AUDIO_BYTES)}
          </p>
        </div>
      )}
    </Card>
  );
}

export default function SettingsAudioPage() {
  const { user, setUser } = useGlobalContext();
  const [introUrl, setIntroUrl] = useState<string | null>(null);
  const [outroUrl, setOutroUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [busyKind, setBusyKind] = useState<Kind | null>(null);
  const fetchedForRef = useRef<string | number | null>(null);

  const syncToUser = useCallback(
    (intro: string | null, outro: string | null) => {
      setIntroUrl(intro);
      setOutroUrl(outro);
      setUser((prev: any) =>
        prev
          ? { ...prev, introAudioUrl: intro || undefined, outroAudioUrl: outro || undefined }
          : prev,
      );
    },
    [setUser],
  );

  useEffect(() => {
    if (!user) return;
    if (fetchedForRef.current === user.fid) return;
    fetchedForRef.current = user.fid;

    (async () => {
      try {
        setLoading(true);
        const token = await buildAuthToken();
        const res = await getIntroOutroAudio(token);
        if (res.ok && res.data?.success) {
          const intro = res.data?.data?.introAudioUrl || null;
          const outro = res.data?.data?.outroAudioUrl || null;
          syncToUser(intro, outro);
        } else {
          setIntroUrl(user.introAudioUrl || null);
          setOutroUrl(user.outroAudioUrl || null);
        }
      } catch (err) {
        console.error('Failed to load intro/outro audio', err);
        setIntroUrl(user.introAudioUrl || null);
        setOutroUrl(user.outroAudioUrl || null);
      } finally {
        setLoading(false);
      }
    })();
  }, [user, syncToUser]);

  const handleUpload = async (kind: Kind, file: File) => {
    if (!user) {
      toast.error('Please sign in first');
      return;
    }
    setBusyKind(kind);
    try {
      const token = await buildAuthToken();
      if (!token) {
        toast.error('Missing auth token');
        return;
      }

      const form = new FormData();
      form.append('kind', kind);
      form.append('file', file);

      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';
      const res = await fetch(`${backendUrl}/api/profile/intro-outro`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });
      const data = await res.json();

      if (!res.ok || !data?.success) {
        throw new Error(data?.error || 'Upload failed');
      }

      const intro = data?.data?.introAudioUrl || null;
      const outro = data?.data?.outroAudioUrl || null;
      syncToUser(intro, outro);
      toast.success(`${kind === 'intro' ? 'Intro' : 'Outro'} audio saved`);
    } catch (err) {
      console.error('Upload error', err);
      toast.error(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setBusyKind(null);
    }
  };

  const handleDelete = async (kind: Kind) => {
    if (!user) return;
    const ok = typeof window !== 'undefined' ? window.confirm(`Remove your ${kind} audio?`) : true;
    if (!ok) return;

    setBusyKind(kind);
    try {
      const token = await buildAuthToken();
      const res = await deleteIntroOutroAudio(kind, token);
      if (!res.ok || !res.data?.success) {
        throw new Error(res.data?.error || 'Failed to remove audio');
      }
      const intro = res.data?.data?.introAudioUrl || null;
      const outro = res.data?.data?.outroAudioUrl || null;
      syncToUser(intro, outro);
      toast.success(`${kind === 'intro' ? 'Intro' : 'Outro'} audio removed`);
    } catch (err) {
      console.error('Delete error', err);
      toast.error(err instanceof Error ? err.message : 'Failed to remove audio');
    } finally {
      setBusyKind(null);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto" />
          <p className="text-white mt-4">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <MainHeader />
      <div className="min-h-screen pb-32">
        <div className="max-w-2xl mx-auto px-4 pt-20 pb-24">
          <Card variant="ghost" className="bg-transparent border-0 p-0">
            <div className="flex items-center gap-3 mb-6">
              <button
                onClick={() => window.history.back()}
                className="grid h-9 w-9 place-items-center rounded-full bg-white/10 text-white"
                aria-label="Go back"
              >
                <IoIosArrowBack className="h-5 w-5" />
              </button>
              <h1 className="text-2xl font-bold text-white">Intro &amp; Outro Music</h1>
            </div>
            <p className="text-white/70 text-sm mb-6">
              Upload short audio clips to play at the start and end of your fireside calls. Only you, as
              the host, can trigger them during a call.
            </p>

            {loading ? (
              <div className="py-10 text-center text-white/60 text-sm">Loading audio settings...</div>
            ) : (
              <div className="space-y-4">
                <AudioUploadCard
                  kind="intro"
                  title="Intro audio"
                  description="Plays when you kick off the call."
                  url={introUrl}
                  busy={busyKind === 'intro'}
                  onUpload={handleUpload}
                  onDelete={handleDelete}
                />
                <AudioUploadCard
                  kind="outro"
                  title="Outro audio"
                  description="Plays when you are wrapping up."
                  url={outroUrl}
                  busy={busyKind === 'outro'}
                  onUpload={handleUpload}
                  onDelete={handleDelete}
                />
              </div>
            )}
          </Card>
        </div>
      </div>
      <NavigationWrapper />
    </>
  );
}
