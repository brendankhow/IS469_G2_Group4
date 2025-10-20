"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"

interface PDFViewerModalProps {
  isOpen: boolean
  onClose: () => void
  pdfUrl: string
  title?: string
}

export function PDFViewerModal({ isOpen, onClose, pdfUrl, title = "Resume" }: PDFViewerModalProps) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    console.log('[PDF Viewer Modal] Component mounted')
    console.log('[PDF Viewer Modal] isOpen:', isOpen)
    console.log('[PDF Viewer Modal] pdfUrl:', pdfUrl)
    setMounted(true)
  }, [])

  if (!mounted) {
    return null
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-none sm:max-w-none w-[90vw] h-[95vh] p-0 border-2 border-primary">
                <DialogHeader className="p-1 pb-0 border-b text-center sm:text-center justify-center">
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <div className="h-[calc(95vh-80px)]">
          <iframe
            src={pdfUrl}
            className="w-full h-full border-0"
            title="PDF Viewer"
            onLoad={() => console.log('[PDF Viewer Modal] PDF iframe loaded successfully')}
            onError={(e) => console.error('[PDF Viewer Modal] Error loading PDF in iframe:', e)}
          />
        </div>
      </DialogContent>
    </Dialog>
  )
}
