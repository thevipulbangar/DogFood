"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion } from "motion/react";
import { ChevronsUpDown, Check, Plus, LogOut, Repeat, Settings2 } from "lucide-react";
import { navFor, ROLE_LABEL } from "@/lib/rbac";
import { EVENT, EVENTS } from "@/lib/data";
import { useSession, type User } from "@/lib/session";
import { cn } from "@/lib/utils";
import { Logo, LogoMark } from "@/components/ui/Logo";
import { Popover, MenuItem } from "@/components/ui/Popover";
import { Avatar, Badge, Kbd, StatusDot } from "@/components/ui/primitives";

export function EventSwitcher({ user }: { user: User }) {
  const router = useRouter();
  const staff = user.role === "organizer" || user.role === "admin";
  return (
    <Popover
      label="Switch event"
      className="w-64"
      trigger={({ toggle, open }) => (
        <button onClick={toggle} aria-expanded={open}
          className="group flex w-full items-center gap-3 rounded-sm border border-line bg-white/[0.02] px-2.5 py-2 text-left transition-colors hover:border-line-strong">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-xs bg-accent font-mono text-[10px] font-bold text-accent-ink">26</span>
          <span className="hidden min-w-0 flex-1 lg:block">
            <span className="block truncate text-[13px] font-medium text-fg">{EVENT.name}</span>
            <span className="flex items-center gap-1.5 font-mono text-[10px] text-muted"><StatusDot tone="ok" pulse />LIVE · {EVENT.id}</span>
          </span>
          <ChevronsUpDown className="hidden size-3.5 text-muted group-hover:text-fg lg:block" />
        </button>
      )}
    >
      {(close) => (
        <div>
          <p className="label px-2.5 pb-1 pt-2">Events on this instance</p>
          {EVENTS.map((e) => (
            <MenuItem key={e.id} disabled={e.status === "ARCHIVE"} onClick={close}>
              <span className="flex-1">
                <span className="block text-fg">{e.name}</span>
                <span className="font-mono text-[10px] text-muted">{e.id}{e.status === "ARCHIVE" && " · NOT IMPORTED"}</span>
              </span>
              {e.status === "LIVE" ? <Check className="size-3.5 text-accent" /> : <Badge>ARCHIVE</Badge>}
            </MenuItem>
          ))}
          {staff && (
            <>
              <div className="my-1 h-px bg-line" />
              <MenuItem onClick={() => { close(); router.push("/admin"); }}><Plus className="size-3.5" />Create event</MenuItem>
            </>
          )}
        </div>
      )}
    </Popover>
  );
}

export function UserMenu({ user, side = "top", compact }: { user: User; side?: "top" | "bottom"; compact?: boolean }) {
  const router = useRouter();
  const { signOut } = useSession();
  const initials = user.name.split(" ").map((s) => s[0]).join("");
  return (
    <Popover
      label="Account"
      side={side}
      align={side === "bottom" ? "right" : "left"}
      className="w-64"
      trigger={({ toggle, open }) => (
        <button onClick={toggle} aria-expanded={open} aria-label="Account menu"
          className={cn("flex w-full items-center gap-2.5 rounded-sm text-left transition-colors hover:bg-white/[0.04]", compact ? "p-0.5" : "p-1.5")}>
          <Avatar initials={initials} size={compact ? 28 : 30} />
          {!compact && (
            <span className="hidden min-w-0 flex-1 lg:block">
              <span className="block truncate text-[13px] text-fg">{user.name}</span>
              <span className="block truncate font-mono text-[10px] uppercase tracking-[0.06em] text-muted">{user.email}</span>
            </span>
          )}
        </button>
      )}
    >
      {(close) => (
        <div>
          <div className="px-2.5 py-2">
            <p className="text-[13px] text-fg">{user.name}</p>
            <p className="font-mono text-[11px] text-muted">{user.email}</p>
            <Badge tone="accent" className="mt-2">{ROLE_LABEL[user.role]}</Badge>
          </div>
          <div className="my-1 h-px bg-line" />
          {(user.role === "admin" || user.role === "organizer") && (
            <MenuItem onClick={() => { close(); router.push("/admin"); }}><Settings2 className="size-3.5" />Settings</MenuItem>
          )}
          <MenuItem onClick={() => { close(); signOut(); router.push("/signin"); }}><Repeat className="size-3.5" />Switch account</MenuItem>
          <MenuItem onClick={() => { close(); signOut(); router.push("/"); }}><LogOut className="size-3.5" />Sign out</MenuItem>
        </div>
      )}
    </Popover>
  );
}

export function Sidebar({ user }: { user: User }) {
  const pathname = usePathname();
  const items = navFor(user.role);
  const groups = [
    { id: "main", label: "Event", items: items.filter((i) => i.group === "main") },
    { id: "admin", label: "Administration", items: items.filter((i) => i.group === "admin") },
  ].filter((g) => g.items.length);

  return (
    <aside className="sticky top-0 hidden h-dvh w-16 shrink-0 flex-col border-r border-line bg-bg md:flex lg:w-60">
      <div className="flex h-14 items-center border-b border-line px-5">
        <Link href="/" aria-label="Dogfood home">
          <Logo className="hidden lg:inline-flex" />
          <LogoMark className="text-fg lg:hidden" />
        </Link>
      </div>

      <div className="p-3"><EventSwitcher user={user} /></div>

      <nav aria-label="Main" className="flex-1 overflow-y-auto px-3 pb-4">
        {groups.map((g) => (
          <div key={g.id} className="mt-3 first:mt-1">
            <p className="label hidden px-2.5 pb-2 lg:block">{g.label}</p>
            {g.id === "admin" && <div className="mx-2 mb-2 h-px bg-line lg:hidden" />}
            <ul className="space-y-0.5">
              {g.items.map((item) => {
                const active = pathname === item.href || pathname.startsWith(item.href + "/");
                const Icon = item.icon;
                return (
                  <li key={item.href}>
                    <Link href={item.href} aria-current={active ? "page" : undefined} title={item.label}
                      className={cn("group relative flex h-9 items-center gap-3 rounded-sm px-2.5 text-[13.5px] transition-colors",
                        active ? "bg-white/[0.05] text-fg" : "text-fg-2 hover:bg-white/[0.03] hover:text-fg")}>
                      {active && <motion.span layoutId="nav-active" className="absolute inset-y-2 left-0 w-[2px] rounded-full bg-accent" transition={{ type: "spring", stiffness: 500, damping: 40 }} />}
                      <Icon className={cn("size-4 shrink-0", active ? "text-accent" : "text-muted group-hover:text-fg-2")} strokeWidth={1.75} />
                      <span className="hidden flex-1 lg:inline">{item.label}</span>
                      {item.shortcut && (
                        <span className="hidden gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 lg:flex">
                          {item.shortcut.split(" ").map((k) => <Kbd key={k}>{k}</Kbd>)}
                        </span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="space-y-2 border-t border-line p-3">
        <div className="hidden rounded-sm border border-line bg-white/[0.015] px-2.5 py-2 lg:block" title="All data lives on this machine">
          <p className="flex items-center gap-2 font-mono text-[10.5px] tracking-[0.06em] text-fg-2"><StatusDot tone="ok" pulse />LOCAL INSTANCE</p>
          <p className="mt-1 flex justify-between font-mono text-[10px] text-muted"><span>{EVENT.instance}</span><span>{EVENT.version}</span></p>
        </div>
        <div className="flex items-center justify-between gap-1">
          <div className="min-w-0 flex-1"><UserMenu user={user} /></div>
        </div>
        <p className="hidden px-1.5 lg:block"><Badge tone="accent">{ROLE_LABEL[user.role]}</Badge></p>
      </div>
    </aside>
  );
}
