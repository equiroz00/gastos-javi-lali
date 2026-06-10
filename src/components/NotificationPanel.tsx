// ── components/NotificationPanel.tsx ─────────────────────────────────────────
import React, { useState } from 'react';
import { Bell, X, ShoppingBag, Pencil, Trash2 } from 'lucide-react';
import { C, F } from '../constants';
import useAppStore from '../store/useAppStore';

interface ActivityEntry {
  id: string;
  action: 'add' | 'edit' | 'delete';
  description: string;
  amount?: number;
  currency?: string;
  doneBy: string;
  timestamp: string;
}

function timeAgo(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60000);
  const hrs  = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 1)  return 'hace un momento';
  if (mins < 60) return `hace ${mins} min`;
  if (hrs  < 24) return `hace ${hrs}h`;
  return `hace ${days}d`;
}

function actionIcon(action: string) {
  const size = 14; const stroke = 1.8;
  if (action === 'add')    return <ShoppingBag size={size} strokeWidth={stroke} />;
  if (action === 'edit')   return <Pencil      size={size} strokeWidth={stroke} />;
  if (action === 'delete') return <Trash2      size={size} strokeWidth={stroke} />;
  return null;
}

function actionLabel(action: string) {
  if (action === 'add')    return 'agregó';
  if (action === 'edit')   return 'editó';
  if (action === 'delete') return 'eliminó';
  return action;
}

export default function NotificationPanel() {
  const currentUser   = useAppStore(s => s.currentUser);
  const activityLog   = useAppStore(s => s.activityLog);
  const lastReadTs    = useAppStore(s => s.lastReadTs);
  const markAllRead   = useAppStore(s => s.markAllRead);

  const [open, setOpen] = useState(false);

  // Only show entries from the OTHER user
  const entries: ActivityEntry[] = (activityLog || [])
    .filter((e: ActivityEntry) => e.doneBy !== currentUser)
    .sort((a: ActivityEntry, b: ActivityEntry) => b.timestamp.localeCompare(a.timestamp))
    .slice(0, 20);

  const hasUnread = entries.some((e: ActivityEntry) => e.timestamp > (lastReadTs || ''));

  function handleOpen() {
    setOpen(true);
    if (hasUnread) markAllRead();
  }

  return (
    <>
      {/* Bell button */}
      <button
        onClick={handleOpen}
        style={{ position:'relative', background:'transparent', border:'1px solid '+C.border, borderRadius:'0.6rem', padding:'0.4rem 0.6rem', color:C.textMuted, cursor:'pointer', display:'flex', alignItems:'center' }}
        aria-label="Notificaciones"
      >
        <Bell size={18} strokeWidth={1.8} />
        {hasUnread && (
          <span style={{ position:'absolute', top:'4px', right:'4px', width:'8px', height:'8px', background:'#EF4444', borderRadius:'50%', border:'2px solid '+C.surface }} />
        )}
      </button>

      {/* Panel overlay */}
      {open && (
        <div style={{ position:'fixed', inset:0, zIndex:300 }} onClick={e => { if (e.target === e.currentTarget) setOpen(false); }}>
          <div style={{ position:'absolute', top:'3.5rem', right:'0.75rem', width:'min(360px, calc(100vw - 1.5rem))', background:C.surface, borderRadius:'1.1rem', boxShadow:'0 8px 32px rgba(0,0,0,0.25)', border:'1px solid '+C.border, overflow:'hidden', fontFamily:F }}>

            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'0.85rem 1rem', borderBottom:'1px solid '+C.border }}>
              <span style={{ fontWeight:800, color:C.navy, fontSize:'0.9rem' }}>Actividad reciente</span>
              <button onClick={() => setOpen(false)} style={{ background:'none', border:'none', cursor:'pointer', color:C.textMuted, display:'flex' }}>
                <X size={18} strokeWidth={2} />
              </button>
            </div>

            <div style={{ maxHeight:'60vh', overflowY:'auto' }}>
              {entries.length === 0 ? (
                <div style={{ padding:'2rem', textAlign:'center', color:C.textMuted, fontSize:'0.85rem' }}>
                  <Bell size={28} strokeWidth={1.5} style={{ marginBottom:'0.5rem', opacity:0.4 }} />
                  <div>Sin actividad reciente</div>
                </div>
              ) : entries.map((e: ActivityEntry) => {
                const isUnread = e.timestamp > (lastReadTs || '');
                return (
                  <div key={e.id} style={{ display:'flex', gap:'0.75rem', padding:'0.75rem 1rem', borderBottom:'1px solid '+C.border, background:isUnread ? C.bg : C.surface }}>
                    <div style={{ flexShrink:0, width:'28px', height:'28px', borderRadius:'50%', background:e.doneBy === 'Javi' ? C.navy : C.accent, display:'flex', alignItems:'center', justifyContent:'center', color:C.white }}>
                      {actionIcon(e.action)}
                    </div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:'0.8rem', color:C.navy, fontWeight:600 }}>
                        <strong>{e.doneBy}</strong> {actionLabel(e.action)} un gasto
                      </div>
                      <div style={{ fontSize:'0.75rem', color:C.textMuted, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', marginTop:'0.1rem' }}>
                        {e.description}{e.amount ? ` · ${e.currency || 'ARS'} ${Math.round(e.amount)}` : ''}
                      </div>
                      <div style={{ fontSize:'0.65rem', color:C.textMuted, marginTop:'0.15rem' }}>
                        {timeAgo(e.timestamp)}
                      </div>
                    </div>
                    {isUnread && <div style={{ width:'6px', height:'6px', borderRadius:'50%', background:'#EF4444', flexShrink:0, marginTop:'0.5rem' }} />}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
