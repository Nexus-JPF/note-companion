'use client'
import * as React from "react";
import { FileList } from "./_components/FileList";
import { UploadCloud, RefreshCw, Clock, CheckCircle } from "lucide-react";

export default function SyncDashboard() {
  return (
    <div className="container max-w-6xl mx-auto p-6">
      <div className="mb-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <header>
          <div className="flex items-center">
            <UploadCloud className="h-6 w-6 mr-2 text-blue-600" />
            <h1 className="text-2xl font-bold">Note Companion Sync</h1>
          </div>
          <p className="text-muted-foreground mt-1">
            View, organize, and manage your uploaded files
          </p>
        </header>
        
        <div className="flex flex-wrap gap-4 bg-slate-50 p-3 rounded-lg">
          <div className="flex items-center gap-2">
            <div className="bg-blue-100 p-2 rounded-full">
              <RefreshCw className="h-4 w-4 text-blue-600" />
            </div>
            <div>
              <p className="text-sm font-medium">Simple Sync</p>
              <p className="text-xs text-muted-foreground">Fast & reliable</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <div className="bg-amber-100 p-2 rounded-full">
              <Clock className="h-4 w-4 text-amber-600" />
            </div>
            <div>
              <p className="text-sm font-medium">Auto Updates</p>
              <p className="text-xs text-muted-foreground">Real-time status</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <div className="bg-emerald-100 p-2 rounded-full">
              <CheckCircle className="h-4 w-4 text-emerald-600" />
            </div>
            <div>
              <p className="text-sm font-medium">Organized</p>
              <p className="text-xs text-muted-foreground">Sort & filter</p>
            </div>
          </div>
        </div>
      </div>
      
      <div className="bg-white rounded-xl shadow-sm border p-6">
        <FileList />
      </div>
    </div>
  );
}
