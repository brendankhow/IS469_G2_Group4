import { useState, useEffect, useRef } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Loader2, Send, Bot, User } from "lucide-react"
import ReactMarkdown from "react-markdown"

interface ChatMessage {
  role: "user" | "assistant"
  content: string
  timestamp: Date
}

interface Applicant {
  id: string  // UUID
  student_id: string  // UUID
  student_name?: string
  student_email?: string
  student_phone?: string
  student_skills?: string
  cover_letter?: string
  resume_url?: string
  resume_filename?: string
  status: "pending" | "accepted" | "rejected"
  created_at: string
}

interface PDFViewerWithChatModalProps {
  isOpen: boolean
  onClose: () => void
  pdfUrl: string
  candidate: Applicant
  title?: string
  chatMessages: ChatMessage[]
  onSendMessage: (message: string) => void
  sendingMessage: boolean
}

export function PDFViewerWithChatModal({
  isOpen,
  onClose,
  pdfUrl,
  candidate,
  title = "Resume",
  chatMessages,
  onSendMessage,
  sendingMessage,
}: PDFViewerWithChatModalProps) {
  const [currentMessage, setCurrentMessage] = useState("")
  const [mounted, setMounted] = useState(false)
  const scrollAreaRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    console.log('[PDF Viewer Chat Modal] Component mounted')
    console.log('[PDF Viewer Chat Modal] isOpen:', isOpen)
    console.log('[PDF Viewer Chat Modal] pdfUrl:', pdfUrl)
    console.log('[PDF Viewer Chat Modal] candidate:', candidate)
    
    setMounted(true)
  }, [])

  useEffect(() => {
    if (isOpen) {
      console.log('[PDF Viewer Chat Modal] Modal opened with URL:', pdfUrl)
    }
  }, [isOpen, pdfUrl])

  useEffect(() => {
    if (scrollAreaRef.current) {
      const scrollContainer = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]')
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight
      }
    }
  }, [chatMessages, sendingMessage])

  function handleSend() {
    if (currentMessage.trim() && !sendingMessage) {
      console.log('[PDF Viewer Chat Modal] Sending message:', currentMessage)
      onSendMessage(currentMessage)
      setCurrentMessage("")
    }
  }

  if (!mounted) {
    return null
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-none sm:max-w-none w-[90vw] h-[95vh] p-0 border-2 border-primary">
        <DialogHeader className="p-1 pb-0 border-b text-center sm:text-center justify-center">
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <div className="flex h-[calc(95vh-80px)]">
          {/* PDF Viewer - 66% width */}
          <div className="flex flex-col w-[66%] border-r">
            <div className="flex-1 flex flex-col items-center p-6 overflow-auto">
              <iframe
                src={pdfUrl}
                className="w-full h-full border-0 rounded-lg"
                title="PDF Viewer"
                onLoad={() => console.log('[PDF Viewer Chat Modal] PDF iframe loaded successfully')}
                onError={(e) => console.error('[PDF Viewer Chat Modal] Error loading PDF in iframe:', e)}
              />
            </div>
          </div>

          {/* AI Chat - 34% width */}
          <div className="flex flex-col w-[34%]">
            <div className="p-4 border-b bg-primary/5">
              <h3 className="font-semibold text-sm flex items-center gap-2">
                <Bot className="h-4 w-4 text-primary" />
                AI Assistant
              </h3>
              <p className="text-xs text-muted-foreground mt-1">Ask about this resume</p>
            </div>

            <div className="flex-1 overflow-hidden" ref={scrollAreaRef}>
              <ScrollArea className="h-full p-4">
                <div className="space-y-4">
                  {chatMessages.map((message, index) => (
                    <div
                      key={index}
                      className={`flex gap-3 ${message.role === "user" ? "justify-end" : "justify-start"}`}
                    >
                      {message.role === "assistant" && (
                        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                          <Bot className="h-4 w-4 text-primary" />
                        </div>
                      )}
                      <div
                        className={`max-w-[80%] rounded-lg p-3 ${
                          message.role === "user"
                            ? "bg-primary text-primary-foreground"
                            : "bg-secondary text-secondary-foreground"
                        }`}
                      >
                        {message.role === "assistant" ? (
                          <div className="text-sm prose prose-sm dark:prose-invert max-w-none">
                            <ReactMarkdown
                              components={{
                                p: ({ children }) => <p className="mb-3 last:mb-0 leading-relaxed">{children}</p>,
                                ul: ({ children }) => <ul className="my-3 ml-4 list-disc space-y-2">{children}</ul>,
                                ol: ({ children }) => <ol className="my-3 ml-4 list-decimal space-y-2">{children}</ol>,
                                li: ({ children }) => <li className="leading-relaxed">{children}</li>,
                                strong: ({ children }) => <strong className="font-semibold text-primary">{children}</strong>,
                                em: ({ children }) => <em className="italic">{children}</em>,
                                code: ({ children }) => <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono">{children}</code>,
                                h1: ({ children }) => <h1 className="text-lg font-bold mb-2 mt-4 first:mt-0">{children}</h1>,
                                h2: ({ children }) => <h2 className="text-base font-bold mb-2 mt-3 first:mt-0">{children}</h2>,
                                h3: ({ children }) => <h3 className="text-sm font-bold mb-2 mt-3 first:mt-0">{children}</h3>,
                                blockquote: ({ children }) => <blockquote className="border-l-2 border-primary pl-3 my-3 italic">{children}</blockquote>,
                              }}
                            >
                              {message.content}
                            </ReactMarkdown>
                          </div>
                        ) : (
                          <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                        )}
                        <p className="text-xs mt-1 opacity-70">
                          {message.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </p>
                      </div>
                      {message.role === "user" && (
                        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-accent flex items-center justify-center">
                          <User className="h-4 w-4 text-accent-foreground" />
                        </div>
                      )}
                    </div>
                  ))}
                  {sendingMessage && (
                    <div className="flex gap-3 justify-start">
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                        <Bot className="h-4 w-4 text-primary" />
                      </div>
                      <div className="bg-secondary text-secondary-foreground rounded-lg p-3">
                        <Loader2 className="h-4 w-4 animate-spin" />
                      </div>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </div>

            <div className="p-4 border-t">
              <div className="flex gap-2">
                <Input
                  placeholder="Ask about this resume..."
                  value={currentMessage}
                  onChange={(e) => setCurrentMessage(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault()
                      handleSend()
                    }
                  }}
                  disabled={sendingMessage}
                  className="flex-1"
                />
                <Button onClick={handleSend} disabled={!currentMessage.trim() || sendingMessage} size="icon">
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
