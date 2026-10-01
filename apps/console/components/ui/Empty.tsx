'use client';
import { FileText } from 'lucide-react';

export function Empty({ title,children }: { title: string; children: React.ReactNode }) { return <div className="empty"><FileText size={30} strokeWidth={1.3}/><h3>{title}</h3>{children}</div>; }
