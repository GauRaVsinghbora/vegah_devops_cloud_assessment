'use client';

import {
  ArrowUpRight, BarChart3, Copy, ExternalLink,
  Link2, Loader2, LogOut, MousePointerClick, Plus, Search, ShieldCheck, Sparkles, Trash2,
  ToggleLeft, ToggleRight, X,
} from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { Analytics, api, ShortUrl } from '../lib/api';

type AuthMode = 'login' | 'register';
type Notice = { kind: 'success' | 'error'; text: string };
const getToken = () => typeof window === 'undefined' ? '' : localStorage.getItem('smarturl_token') ?? '';
const getEmail = () => typeof window === 'undefined' ? '' : localStorage.getItem('smarturl_email') ?? '';
const showDate = (date: string) => new Date(date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

export function Landing() {
  return <main className="min-h-screen overflow-hidden bg-[#f7f8fc] text-slate-900">
    <nav className="mx-auto flex max-w-7xl items-center justify-between px-6 py-6 lg:px-10">
      <Link href="/" className="flex items-center gap-2 text-xl font-bold tracking-tight"><span className="grid h-9 w-9 place-items-center rounded-xl bg-indigo-600 text-white"><Link2 size={19} /></span>smarturl</Link>
      <div className="flex items-center gap-3"><Link href="/login" className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-600 hover:text-slate-950">Log in</Link><Link href="/register" className="rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-200 hover:bg-indigo-700">Get started</Link></div>
    </nav>
    <section className="mx-auto grid max-w-7xl items-center gap-14 px-6 pb-24 pt-16 lg:grid-cols-[1.05fr_.95fr] lg:px-10 lg:pb-32 lg:pt-24">
      <div><div className="mb-6 inline-flex items-center gap-2 rounded-full border border-indigo-100 bg-white px-3 py-1.5 text-xs font-semibold text-indigo-700"><Sparkles size={14} /> Links that work smarter</div>
        <h1 className="max-w-2xl text-5xl font-bold leading-[1.08] tracking-[-.045em] sm:text-6xl">Short links.<br /><span className="text-indigo-600">Long-term insight.</span></h1>
        <p className="mt-6 max-w-lg text-lg leading-8 text-slate-500">Create memorable links and understand every click with clean, real-time analytics built for your team.</p>
        <div className="mt-9 flex flex-wrap gap-3"><Link href="/register" className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-6 py-3.5 font-semibold text-white shadow-xl shadow-indigo-200 transition hover:-translate-y-0.5 hover:bg-indigo-700">Create your free account <ArrowUpRight size={17} /></Link><Link href="/login" className="rounded-xl border border-slate-200 bg-white px-6 py-3.5 font-semibold text-slate-700 hover:bg-slate-50">Sign in</Link></div>
        <div className="mt-10 flex items-center gap-3 text-sm text-slate-500"><ShieldCheck size={17} className="text-emerald-600" /> Secure accounts. Private analytics. No raw IP storage.</div>
      </div>
      <div className="relative"><div className="absolute -inset-8 rounded-[3rem] bg-gradient-to-br from-indigo-100 via-violet-50 to-sky-100 blur-2xl" />
        <div className="relative rounded-3xl border border-white bg-white p-5 shadow-2xl shadow-indigo-100 sm:p-7">
          <div className="flex items-center justify-between"><div><p className="text-sm font-semibold text-slate-900">Link analytics</p><p className="mt-1 text-xs text-slate-400">A clearer view of your audience</p></div><div className="rounded-lg bg-indigo-50 p-2 text-indigo-600"><BarChart3 size={19} /></div></div>
          <div className="mt-6 grid h-48 place-items-center rounded-2xl bg-indigo-50/60 px-5 text-center"><div><div className="mx-auto grid h-11 w-11 place-items-center rounded-xl bg-white text-indigo-600 shadow-sm"><BarChart3 size={20} /></div><p className="mt-3 text-sm font-semibold text-slate-700">Your click activity</p><p className="mt-1 text-xs text-slate-500">Share a link to see real analytics here.</p></div></div>
          <div className="mt-5 flex items-center gap-3 rounded-xl border border-slate-100 p-3.5"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-violet-50 text-violet-600"><Link2 size={17} /></span><div><p className="text-sm font-semibold">Your links, all in one place</p><p className="mt-1 text-xs text-slate-400">Create a SmartURL account to get started.</p></div></div>
        </div>
      </div>
    </section>
    <section className="border-y border-slate-100 bg-white px-6 py-12"><div className="mx-auto grid max-w-6xl gap-8 sm:grid-cols-3">{[['Fast redirects', 'Redis-powered links that get people where they need to go.'], ['Useful analytics', 'Understand clicks, devices, browsers, and referrers.'], ['Made for focus', 'Manage every link in one simple, searchable workspace.']].map(([title, copy], i) => <div key={title} className="flex gap-4"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-indigo-50 text-indigo-600">{i === 0 ? <MousePointerClick size={19} /> : i === 1 ? <BarChart3 size={19} /> : <Link2 size={19} />}</span><div><h2 className="font-semibold">{title}</h2><p className="mt-1 text-sm leading-6 text-slate-500">{copy}</p></div></div>)}</div></section>
    <footer className="mx-auto flex max-w-7xl justify-between px-6 py-7 text-xs text-slate-400 lg:px-10"><span>© {new Date().getFullYear()} SmartURL</span><span>Links, with a little more meaning.</span></footer>
  </main>;
}

export function AuthPage({ mode }: { mode: AuthMode }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const result = await api.auth(mode, email, password);
      localStorage.setItem('smarturl_token', result.token);
      localStorage.setItem('smarturl_email', result.user.email);
      window.location.assign('/dashboard');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to authenticate.');
    } finally {
      setBusy(false);
    }
  }

  return <main className="grid min-h-screen bg-white lg:grid-cols-2">
    <section className="hidden flex-col justify-between bg-[#15162c] p-12 text-white lg:flex"><Link href="/" className="flex items-center gap-2 text-xl font-bold"><span className="grid h-9 w-9 place-items-center rounded-xl bg-indigo-500"><Link2 size={19} /></span>smarturl</Link><div className="max-w-lg"><p className="text-sm font-semibold uppercase tracking-[.2em] text-indigo-300">A better way to share</p><h1 className="mt-5 text-5xl font-bold leading-tight">Make every link count.</h1><p className="mt-5 text-lg leading-8 text-slate-300">Build a clearer picture of your audience with thoughtful link management and analytics.</p></div><p className="text-xs text-slate-500">SmartURL · Links with insight</p></section>
    <section className="flex items-center justify-center px-6 py-12"><div className="w-full max-w-md">
      <Link href="/" className="mb-12 inline-flex items-center gap-2 text-lg font-bold lg:hidden"><span className="grid h-8 w-8 place-items-center rounded-lg bg-indigo-600 text-white"><Link2 size={17} /></span>smarturl</Link>
      <p className="text-sm font-semibold text-indigo-600">{mode === 'login' ? 'WELCOME BACK' : 'GET STARTED'}</p><h2 className="mt-2 text-3xl font-bold tracking-tight">{mode === 'login' ? 'Sign in to SmartURL' : 'Create your account'}</h2><p className="mt-2 text-sm text-slate-500">{mode === 'login' ? 'Pick up where you left off.' : 'Your links and analytics, all in one place.'}</p>
      <form className="mt-8 space-y-5" onSubmit={submit}><label className="block text-sm font-semibold text-slate-700">Email address<input required type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 font-normal outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50" placeholder="you@company.com" /></label><label className="block text-sm font-semibold text-slate-700">Password<input required type="password" minLength={8} maxLength={128} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} value={password} onChange={(event) => setPassword(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 font-normal outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50" placeholder="At least 8 characters" /></label>
        {error && <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2.5 text-sm text-rose-700">{error}</p>}
        <button disabled={busy} className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3.5 font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-60">{busy && <Loader2 className="animate-spin" size={17} />}{mode === 'login' ? 'Sign in' : 'Create account'}</button>
      </form><p className="mt-7 text-center text-sm text-slate-500">{mode === 'login' ? 'New to SmartURL?' : 'Already have an account?'} <a className="font-semibold text-indigo-600 hover:text-indigo-700" href={mode === 'login' ? '/register' : '/login'}>{mode === 'login' ? 'Create an account' : 'Sign in'}</a></p>
    </div></section>
  </main>;
}

function Sidebar({ active, email, onLogout }: { active: string; email: string; onLogout: () => void }) {
  const links = [['Overview', '/dashboard', BarChart3], ['My URLs', '/urls', Link2]];
  return <aside className="flex w-full shrink-0 flex-col border-b border-slate-200 bg-white lg:min-h-screen lg:w-64 lg:border-b-0 lg:border-r">
    <a href="/dashboard" className="flex items-center gap-2 px-6 py-5 text-lg font-bold tracking-tight"><span className="grid h-8 w-8 place-items-center rounded-lg bg-indigo-600 text-white"><Link2 size={17} /></span>smarturl</a>
    <p className="px-6 pb-2 pt-5 text-[10px] font-bold uppercase tracking-[.18em] text-slate-400">Workspace</p>
    <nav className="flex gap-1 px-3 lg:flex-col">{links.map(([label, href, Icon]) => <a key={href as string} href={href as string} className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold transition ${active === href ? 'bg-indigo-50 text-indigo-700' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'}`}><Icon size={17} />{label as string}</a>)}</nav>
    <div className="mt-auto hidden border-t border-slate-100 p-4 lg:block"><div className="flex items-center gap-3"><div className="grid h-9 w-9 place-items-center rounded-full bg-indigo-100 text-sm font-bold text-indigo-700">{email.slice(0, 1).toUpperCase() || 'U'}</div><div className="min-w-0 flex-1"><p className="truncate text-xs font-semibold text-slate-700">{email}</p><p className="text-[11px] text-slate-400">Personal workspace</p></div><button onClick={onLogout} aria-label="Log out" className="text-slate-400 hover:text-rose-600"><LogOut size={16} /></button></div></div>
  </aside>;
}

function Metric({ label, value, icon: Icon, hint }: { label: string; value: number; icon: typeof Link2; hint?: string }) {
  return <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center justify-between"><p className="text-sm font-medium text-slate-500">{label}</p><span className="grid h-9 w-9 place-items-center rounded-xl bg-indigo-50 text-indigo-600"><Icon size={17} /></span></div><p className="mt-4 text-3xl font-bold tracking-tight">{value.toLocaleString()}</p>{hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}</div>;
}

function Chart({ values }: { values: { _id: string; clicks: number }[] }) {
  const latest = useMemo(() => {
    const map = new Map(values.map((item) => [item._id, item.clicks]));
    return Array.from({ length: 7 }, (_, index) => {
      const day = new Date();
      day.setDate(day.getDate() - (6 - index));
      const key = day.toISOString().slice(0, 10);
      return { label: day.toLocaleDateString(undefined, { weekday: 'short' }), clicks: map.get(key) ?? 0 };
    });
  }, [values]);
  const max = Math.max(...latest.map((item) => item.clicks), 1);
  return <div className="mt-7 flex h-48 items-end gap-3 sm:gap-6">{latest.map((item) => <div key={item.label} className="flex h-full flex-1 flex-col items-center justify-end gap-2"><div className="flex w-full flex-1 items-end"><div title={`${item.clicks} clicks`} style={{ height: `${Math.max((item.clicks / max) * 100, item.clicks ? 8 : 2)}%` }} className="w-full rounded-t-lg bg-indigo-500 transition hover:bg-indigo-600" /></div><span className="text-[11px] text-slate-400">{item.label}</span></div>)}</div>;
}

export function Dashboard({ urlsOnly = false }: { urlsOnly?: boolean }) {
  const [token, setToken] = useState('');
  const [email, setEmail] = useState('');
  const [urls, setUrls] = useState<ShortUrl[]>([]);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [search, setSearch] = useState('');
  const [originalUrl, setOriginalUrl] = useState('');
  const [customCode, setCustomCode] = useState('');
  const [adding, setAdding] = useState(false);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [modal, setModal] = useState(false);

  useEffect(() => {
    const stored = getToken();
    if (!stored) { window.location.replace('/login'); return; }
    setToken(stored);
    setEmail(getEmail());
  }, []);

  const refresh = useCallback(async (currentToken = token, query = search) => {
    if (!currentToken) return;
    try {
      const [urlData, analyticsData] = await Promise.all([api.urls(currentToken, query), api.analytics(currentToken)]);
      setUrls(urlData);
      setAnalytics(analyticsData);
    } catch (error) {
      setNotice({ kind: 'error', text: error instanceof Error ? error.message : 'Unable to load your data.' });
    } finally {
      setLoading(false);
    }
  }, [search, token]);

  useEffect(() => { if (token) void refresh(); }, [token, refresh]);

  function logout() {
    localStorage.removeItem('smarturl_token');
    localStorage.removeItem('smarturl_email');
    window.location.assign('/');
  }
  async function addUrl(event: FormEvent) {
    event.preventDefault();
    setAdding(true);
    setNotice(null);
    try {
      await api.createUrl(token, originalUrl, customCode);
      setOriginalUrl('');
      setCustomCode('');
      setModal(false);
      setNotice({ kind: 'success', text: 'Your short link is ready to share.' });
      await refresh();
    } catch (error) {
      setNotice({ kind: 'error', text: error instanceof Error ? error.message : 'Unable to create the link.' });
    } finally {
      setAdding(false);
    }
  }
  async function toggle(url: ShortUrl) {
    try { await api.setStatus(token, url.id, url.status === 'ACTIVE' ? 'DISABLED' : 'ACTIVE'); await refresh(); }
    catch (error) { setNotice({ kind: 'error', text: error instanceof Error ? error.message : 'Unable to update link.' }); }
  }
  async function remove(url: ShortUrl) {
    if (!window.confirm(`Permanently delete ${url.shortCode}?`)) return;
    try { await api.deleteUrl(token, url.id); await refresh(); setNotice({ kind: 'success', text: 'Link deleted.' }); }
    catch (error) { setNotice({ kind: 'error', text: error instanceof Error ? error.message : 'Unable to delete link.' }); }
  }
  async function copy(value: string) {
    try { await navigator.clipboard.writeText(value); setNotice({ kind: 'success', text: 'Short link copied to clipboard.' }); }
    catch { setNotice({ kind: 'error', text: 'Clipboard access is unavailable in this browser.' }); }
  }
  const maxClicks = Math.max(...(analytics?.topUrls.map((url) => url.clicks) ?? [0]), 1);

  return <div className="min-h-screen bg-[#f7f8fc] text-slate-900 lg:flex"><Sidebar active={urlsOnly ? '/urls' : '/dashboard'} email={email} onLogout={logout} />
    <main className="min-w-0 flex-1">
      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-5 py-5 sm:px-8"><div><p className="text-xs font-semibold uppercase tracking-[.16em] text-indigo-600">Workspace</p><h1 className="mt-1 text-xl font-bold">{urlsOnly ? 'My URLs' : 'Overview'}</h1></div><button onClick={() => setModal(true)} className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700"><Plus size={16} /> <span className="hidden sm:inline">Create link</span><span className="sm:hidden">Create</span></button></header>
      <div className="mx-auto max-w-7xl space-y-6 p-5 sm:p-8">
        {notice && <div role="status" className={`flex items-center justify-between rounded-xl px-4 py-3 text-sm ${notice.kind === 'error' ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-700'}`}>{notice.text}<button onClick={() => setNotice(null)} aria-label="Dismiss notification"><X size={15} /></button></div>}
        {!urlsOnly && <><section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><Metric label="Total links" value={analytics?.totalUrls ?? 0} icon={Link2} hint="Across your workspace" /><Metric label="Total clicks" value={analytics?.totalClicks ?? 0} icon={MousePointerClick} hint="Lifetime link visits" /><Metric label="Active links" value={analytics?.activeUrls ?? 0} icon={ArrowUpRight} hint="Ready to share" /><Metric label="Top link clicks" value={analytics?.topUrls[0]?.clicks ?? 0} icon={Sparkles} hint={analytics?.topUrls[0]?.shortCode ?? 'No clicks yet'} /></section>
          <section className="grid gap-6 xl:grid-cols-[1.5fr_1fr]"><div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"><div className="flex items-start justify-between"><div><h2 className="font-bold">Click activity</h2><p className="mt-1 text-sm text-slate-400">Daily link clicks · last 7 days</p></div><div className="rounded-lg bg-indigo-50 p-2 text-indigo-600"><BarChart3 size={18} /></div></div>{analytics && analytics.totalClicks > 0 ? <Chart values={analytics.clicksOverTime} /> : <div className="grid h-48 place-items-center text-center"><div><MousePointerClick className="mx-auto text-slate-300" /><p className="mt-2 text-sm font-medium text-slate-500">Your click activity will appear here</p><p className="mt-1 text-xs text-slate-400">Share a link to start collecting analytics.</p></div></div>}</div>
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"><div><h2 className="font-bold">Popular links</h2><p className="mt-1 text-sm text-slate-400">Ranked by total clicks</p></div>{analytics?.topUrls.length ? <div className="mt-5 space-y-4">{analytics.topUrls.map((item, index) => <div key={item.shortCode}><div className="mb-2 flex items-center justify-between gap-3 text-sm"><a className="truncate font-medium text-slate-700 hover:text-indigo-600" href={`/analytics/${urls.find((url) => url.shortCode === item.shortCode)?.id}`}>{item.shortCode}</a><span className="shrink-0 font-semibold">{item.clicks.toLocaleString()}</span></div><div className="h-1.5 rounded-full bg-slate-100"><div className="h-full rounded-full bg-indigo-500" style={{ width: `${Math.max(item.clicks / maxClicks * 100, 3)}%`, opacity: 1 - index * .1 }} /></div></div>)}</div> : <div className="grid h-40 place-items-center text-sm text-slate-400">No link clicks yet.</div>}</div></section>
          <section className="grid gap-5 md:grid-cols-3">{[['Browsers', analytics?.browsers], ['Devices', analytics?.devices], ['Referrers', analytics?.referrers]].map(([label, entries]) => <div key={label as string} className="rounded-2xl border border-slate-200 bg-white p-5"><h2 className="font-bold">{label as string}</h2>{(entries as Analytics['browsers'] | undefined)?.length ? <div className="mt-4 space-y-3">{(entries as Analytics['browsers']).slice(0, 5).map((entry) => <div key={entry._id}><div className="mb-1 flex justify-between gap-2 text-xs"><span className="truncate text-slate-600">{entry._id || 'Direct / unknown'}</span><span className="font-semibold">{entry.count}</span></div><div className="h-1.5 rounded-full bg-slate-100"><div className="h-full rounded-full bg-indigo-500" style={{ width: `${Math.max(entry.count / Math.max(...(entries as Analytics['browsers']).map((item) => item.count), 1) * 100, 3)}%` }} /></div></div>)}</div> : <p className="mt-5 text-sm text-slate-400">No click data yet.</p>}</div>)}</section>
          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white"><div className="border-b border-slate-100 p-5"><h2 className="font-bold">Recent activity</h2><p className="mt-1 text-sm text-slate-400">Latest recorded link visits</p></div>{analytics?.recentActivity.length ? <div className="divide-y divide-slate-100">{analytics.recentActivity.slice(0, 5).map((event, index) => <div key={`${event.short_code}-${event.clicked_at}-${index}`} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 text-sm"><div><p className="font-semibold">{event.short_code} · {event.browser} · {event.device_type}</p><p className="mt-1 text-xs text-slate-400">{event.referrer || 'Direct'}</p></div><time className="text-xs text-slate-400">{new Date(event.clicked_at).toLocaleString()}</time></div>)}</div> : <p className="p-8 text-center text-sm text-slate-400">Click activity will appear here when someone visits your links.</p>}</section></>}
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="flex flex-col gap-3 border-b border-slate-100 p-5 sm:flex-row sm:items-center sm:justify-between sm:px-6"><div><h2 className="font-bold">{urlsOnly ? 'All your links' : 'Recent links'}</h2><p className="mt-1 text-sm text-slate-400">{urls.length} {urls.length === 1 ? 'link' : 'links'} in your workspace</p></div><form className="relative w-full sm:max-w-xs" onSubmit={(event) => { event.preventDefault(); void refresh(token, search); }}><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search URLs..." className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-50" /></form></div>
          {loading ? <div className="grid min-h-56 place-items-center"><Loader2 className="animate-spin text-indigo-500" /></div> : urls.length === 0 ? <div className="px-6 py-16 text-center"><div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-indigo-50 text-indigo-600"><Link2 /></div><p className="mt-4 font-semibold">No links found</p><p className="mt-1 text-sm text-slate-400">{search ? 'Try another search term.' : 'Create your first short link to get started.'}</p>{!search && <button onClick={() => setModal(true)} className="mt-4 text-sm font-semibold text-indigo-600">Create a link <ArrowUpRight className="inline" size={15} /></button>}</div> :
            <div className="overflow-x-auto"><table className="w-full min-w-[730px] text-left text-sm"><thead className="bg-slate-50/70 text-[11px] font-semibold uppercase tracking-wider text-slate-400"><tr><th className="px-6 py-3">Link</th><th className="px-5 py-3">Clicks</th><th className="px-5 py-3">Created</th><th className="px-5 py-3">Status</th><th className="px-5 py-3">Actions</th></tr></thead><tbody className="divide-y divide-slate-100">{urls.map((url) => <tr key={url.id} className="hover:bg-slate-50/70"><td className="max-w-[360px] px-6 py-4"><div className="flex min-w-0 items-center gap-3"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-indigo-50 text-indigo-600"><Link2 size={16} /></span><div className="min-w-0"><a href={`/analytics/${url.id}`} className="block truncate font-semibold text-indigo-700 hover:text-indigo-900">{url.shortUrl}</a><p className="mt-1 truncate text-xs text-slate-400">{url.originalUrl}</p></div></div></td><td className="px-5 py-4 font-semibold">{url.clicks.toLocaleString()}</td><td className="whitespace-nowrap px-5 py-4 text-slate-500">{showDate(url.createdAt)}</td><td className="px-5 py-4"><span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${url.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>{url.status === 'ACTIVE' ? 'Active' : 'Disabled'}</span></td><td className="px-5 py-4"><div className="flex items-center gap-1"><button onClick={() => void copy(url.shortUrl)} title="Copy short URL" className="rounded-md p-2 text-slate-400 hover:bg-indigo-50 hover:text-indigo-600"><Copy size={15} /></button><a href={`/analytics/${url.id}`} title="View analytics" className="rounded-md p-2 text-slate-400 hover:bg-indigo-50 hover:text-indigo-600"><BarChart3 size={15} /></a><button onClick={() => void toggle(url)} title={url.status === 'ACTIVE' ? 'Disable link' : 'Enable link'} className="rounded-md p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700">{url.status === 'ACTIVE' ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}</button><button onClick={() => void remove(url)} title="Delete link" className="rounded-md p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600"><Trash2 size={15} /></button></div></td></tr>)}</tbody></table></div>}
        </section>
      </div>
    </main>
    {modal && <div className="fixed inset-0 z-30 grid place-items-center bg-slate-950/40 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) setModal(false); }}><div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl"><div className="flex items-start justify-between"><div><p className="text-xs font-bold uppercase tracking-wider text-indigo-600">New short link</p><h2 className="mt-1 text-xl font-bold">Create a link</h2><p className="mt-1 text-sm text-slate-500">Enter a destination URL to generate your shareable link.</p></div><button onClick={() => setModal(false)} aria-label="Close dialog" className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"><X size={18} /></button></div>
      <form onSubmit={addUrl} className="mt-6 space-y-4"><label className="block text-sm font-semibold">Destination URL<input required type="url" pattern="https?://.+" value={originalUrl} onChange={(event) => setOriginalUrl(event.target.value)} placeholder="https://example.com/your-long-url" className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-3 text-sm font-normal outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-50" /></label><label className="block text-sm font-semibold">Custom code <span className="font-normal text-slate-400">· optional</span><div className="mt-2 flex items-center overflow-hidden rounded-lg border border-slate-200 focus-within:border-indigo-400"><span className="bg-slate-50 px-3 py-3 text-sm text-slate-400">/api/r/</span><input value={customCode} onChange={(event) => setCustomCode(event.target.value)} pattern="[a-zA-Z0-9_-]{3,16}" maxLength={16} placeholder="summer-sale" className="min-w-0 flex-1 px-3 py-3 text-sm font-normal outline-none" /></div><span className="mt-1 block text-xs font-normal text-slate-400">3–16 letters, numbers, dashes, or underscores.</span></label><div className="flex justify-end gap-3 pt-2"><button type="button" onClick={() => setModal(false)} className="rounded-lg px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50">Cancel</button><button disabled={adding} className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60">{adding && <Loader2 size={15} className="animate-spin" />}Create link</button></div></form></div></div>}
  </div>;
}

export function AnalyticsDetails() {
  const params = useParams<{ id: string }>();
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    const token = getToken();
    if (!token) { window.location.replace('/login'); return; }
    api.urlAnalytics(token, params.id).then(setData).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'Unable to load analytics.'));
  }, [params.id]);
  const url = data?.url as ShortUrl | undefined;
  const activity = data?.clicksOverTime as { _id: string; clicks: number }[] | undefined;
  const browsers = data?.browsers as { _id: string; count: number }[] | undefined;
  const devices = data?.devices as { _id: string; count: number }[] | undefined;
  const referrers = data?.referrers as { _id: string; count: number }[] | undefined;
  const recent = data?.recentActivity as { browser: string; operating_system: string; device_type: string; referrer: string | null; clicked_at: string }[] | undefined;
  const total = data?.totalClicks as number | undefined;
  const bars = (title: string, values: { _id: string; count: number }[] | undefined) => <div className="rounded-2xl border border-slate-200 bg-white p-5"><h2 className="font-bold">{title}</h2>{values?.length ? <div className="mt-4 space-y-3">{values.map((entry) => <div key={entry._id}><div className="mb-1 flex justify-between text-xs"><span className="truncate text-slate-600">{entry._id || 'Direct / unknown'}</span><span className="font-semibold">{entry.count}</span></div><div className="h-1.5 rounded-full bg-slate-100"><div className="h-full rounded-full bg-indigo-500" style={{ width: `${Math.max(entry.count / Math.max(...values.map((item) => item.count), 1) * 100, 3)}%` }} /></div></div>)}</div> : <p className="mt-6 text-sm text-slate-400">No click data yet.</p>}</div>;
  return <div className="min-h-screen bg-[#f7f8fc]"><header className="flex items-center justify-between border-b bg-white px-5 py-4 sm:px-8"><a href="/dashboard" className="flex items-center gap-2 font-bold"><span className="grid h-8 w-8 place-items-center rounded-lg bg-indigo-600 text-white"><Link2 size={16} /></span>smarturl</a><a href="/urls" className="text-sm font-semibold text-indigo-600">Back to links</a></header><main className="mx-auto max-w-6xl space-y-6 p-5 sm:p-8">
    {error ? <div role="alert" className="rounded-xl bg-rose-50 p-4 text-rose-700">{error}</div> : !data ? <div className="grid min-h-64 place-items-center"><Loader2 className="animate-spin text-indigo-500" /></div> : <>
      <div><p className="text-xs font-bold uppercase tracking-wider text-indigo-600">Link analytics</p><h1 className="mt-2 break-all text-2xl font-bold">{url?.shortUrl}</h1><p className="mt-2 break-all text-sm text-slate-500">{url?.originalUrl}</p><a className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-indigo-600" href={url?.originalUrl} target="_blank" rel="noreferrer">Open destination <ExternalLink size={14} /></a></div>
      <section className="grid gap-4 sm:grid-cols-3"><Metric label="Total clicks" value={total ?? 0} icon={MousePointerClick} /><div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-sm font-medium text-slate-500">Link status</p><p className="mt-4"><span className={`rounded-full px-3 py-1.5 text-sm font-semibold ${url?.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>{url?.status}</span></p><p className="mt-2 text-xs text-slate-400">Current redirect availability</p></div><div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-sm font-medium text-slate-500">Created</p><p className="mt-4 text-xl font-bold">{url ? showDate(url.createdAt) : '—'}</p><p className="mt-2 text-xs text-slate-400">Link creation date</p></div></section>
      <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6"><h2 className="font-bold">Clicks over time</h2>{(activity?.length ?? 0) ? <Chart values={activity ?? []} /> : <div className="grid h-36 place-items-center text-sm text-slate-400">Click activity will appear here when someone visits your link.</div>}</section>
      <section className="grid gap-5 md:grid-cols-3">{bars('Browsers', browsers)}{bars('Devices', devices)}{bars('Referrers', referrers)}</section>
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white"><div className="border-b border-slate-100 p-5"><h2 className="font-bold">Recent activity</h2><p className="mt-1 text-sm text-slate-400">Click events are recorded without raw IP addresses.</p></div>{recent?.length ? <div className="divide-y divide-slate-100">{recent.map((event, index) => <div key={`${event.clicked_at}-${index}`} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 text-sm"><div><p className="font-semibold">{event.browser} · {event.operating_system}</p><p className="mt-1 text-xs text-slate-400">{event.device_type} · {event.referrer || 'Direct'}</p></div><time className="text-xs text-slate-400">{new Date(event.clicked_at).toLocaleString()}</time></div>)}</div> : <p className="p-8 text-center text-sm text-slate-400">No clicks recorded yet.</p>}</section>
    </>}
  </main></div>;
}
