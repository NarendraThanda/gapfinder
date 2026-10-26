'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  LuBookOpen,
  LuChevronDown,
  LuCheck,
  LuPlus,
  LuLayers,
} from 'react-icons/lu'

export interface MaterialOption {
  id: string
  title: string
  type: string
  status: string
}

interface MaterialContextSelectorProps {
  materials: MaterialOption[]
  activeMaterialId: string | null
  onSelectMaterial: (materialId: string) => void
  label?: string
}

export default function MaterialContextSelector({
  materials,
  activeMaterialId,
  onSelectMaterial,
  label = 'Active Study Material:',
}: MaterialContextSelectorProps) {
  const [isOpen, setIsOpen] = useState(false)

  const activeMaterial = materials.find((m) => m.id === activeMaterialId)
  const displayTitle = activeMaterial
    ? activeMaterial.title
    : activeMaterialId === 'all'
    ? 'All Materials (Combined)'
    : materials.length > 0
    ? materials[0].title
    : 'No Materials Uploaded'

  return (
    <div className="relative inline-block text-left z-20">
      <div className="flex items-center gap-2">
        {label && (
          <span className="text-xs font-semibold text-gray-400 hidden sm:inline flex items-center gap-1.5">
            <LuLayers size={13} className="text-purple-400" />
            {label}
          </span>
        )}

        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="glass px-3.5 py-2 rounded-xl border border-white/10 hover:border-purple-500/40 text-xs font-bold text-white flex items-center gap-2 transition-all bg-white/[0.03] hover:bg-white/[0.06] shadow-sm max-w-[280px] sm:max-w-[340px]"
        >
          <LuBookOpen size={14} className="text-purple-400 shrink-0" />
          <span className="truncate text-left">{displayTitle}</span>
          <LuChevronDown
            size={14}
            className={`text-gray-400 transition-transform shrink-0 ml-auto ${
              isOpen ? 'rotate-180' : ''
            }`}
          />
        </button>
      </div>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-20"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute right-0 sm:left-0 mt-2 w-72 sm:w-80 rounded-2xl glass border border-white/10 shadow-2xl p-2 z-30 animate-fadeIn backdrop-blur-xl bg-black/80">
            <div className="px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-gray-400 border-b border-white/5 flex items-center justify-between">
              <span>Switch Subject / Material</span>
              <span className="text-[10px] text-purple-400">{materials.length} uploaded</span>
            </div>

            <div className="max-h-64 overflow-y-auto space-y-1 py-1.5 custom-scrollbar">
              {materials.length === 0 ? (
                <div className="p-4 text-center text-xs text-gray-400">
                  No materials uploaded yet.
                </div>
              ) : (
                materials.map((mat) => {
                  const isSelected = activeMaterialId === mat.id
                  return (
                    <button
                      key={mat.id}
                      onClick={() => {
                        onSelectMaterial(mat.id)
                        setIsOpen(false)
                      }}
                      className={`w-full text-left px-3 py-2.5 rounded-xl text-xs flex items-center justify-between gap-2 transition-all ${
                        isSelected
                          ? 'bg-purple-600/30 text-white font-bold border border-purple-500/40 shadow-sm'
                          : 'text-gray-300 hover:text-white hover:bg-white/5'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-semibold">{mat.title}</div>
                        <div className="text-[10px] text-gray-400 capitalize">
                          {mat.type} • {mat.status}
                        </div>
                      </div>
                      {isSelected && (
                        <LuCheck size={14} className="text-purple-400 shrink-0" />
                      )}
                    </button>
                  )
                })
              )}
            </div>

            <div className="pt-2 border-t border-white/5 mt-1 flex items-center justify-between gap-2">
              {materials.length > 1 && (
                <button
                  onClick={() => {
                    onSelectMaterial('all')
                    setIsOpen(false)
                  }}
                  className={`text-[11px] px-2.5 py-1.5 rounded-lg transition-colors font-semibold ${
                    activeMaterialId === 'all'
                      ? 'text-purple-400 font-bold'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  All Materials
                </button>
              )}

              <Link
                href="/materials"
                onClick={() => setIsOpen(false)}
                className="ml-auto text-[11px] text-purple-300 hover:text-purple-200 flex items-center gap-1 font-semibold px-2 py-1.5 hover:bg-purple-500/10 rounded-lg transition-colors"
              >
                <LuPlus size={13} />
                <span>Upload New Material</span>
              </Link>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
