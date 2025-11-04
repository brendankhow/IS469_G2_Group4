"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Share2, Copy, Check, ExternalLink } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

interface ShareableChatLinkProps {
  studentId: string
  studentName?: string
}

export function ShareableChatLink({ studentId, studentName }: ShareableChatLinkProps) {
  const { toast } = useToast()
  const [copied, setCopied] = useState(false)
  
  // Generate the shareable link
  const baseUrl = typeof window !== "undefined" ? window.location.origin : ""
  const shareableLink = `${baseUrl}/chat/${studentId}`

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareableLink)
      setCopied(true)
      toast({
        title: "Link Copied!",
        description: "Your shareable chat link has been copied to clipboard",
      })
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      console.error("Failed to copy:", error)
      toast({
        title: "Copy Failed",
        description: "Please manually copy the link",
        variant: "destructive",
      })
    }
  }

  const handleOpenLink = () => {
    window.open(shareableLink, "_blank")
  }

  return (
    <Card className="border-2">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Share2 className="h-5 w-5 text-primary" />
          Shareable AI Chat Link
        </CardTitle>
        <CardDescription>
          Share this link with recruiters or anyone interested in learning about {studentName ? `${studentName}'s` : "your"} profile through an AI-powered chat
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Input
            value={shareableLink}
            readOnly
            className="flex-1 font-mono text-sm"
          />
          <Button
            onClick={handleCopyLink}
            variant="outline"
            size="icon"
            className="flex-shrink-0"
          >
            {copied ? (
              <Check className="h-4 w-4 text-green-600" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
          </Button>
          <Button
            onClick={handleOpenLink}
            variant="outline"
            size="icon"
            className="flex-shrink-0"
          >
            <ExternalLink className="h-4 w-4" />
          </Button>
        </div>
        
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">
            <strong>What this link does:</strong>
          </p>
          <ul className="text-xs text-muted-foreground space-y-1 ml-4 list-disc">
            <li>Provides a public AI chatbot about your profile</li>
            <li>No login required for viewers</li>
            <li>Answers questions about your skills, experience, and projects</li>
            <li>Uses your resume, GitHub portfolio, and personality insights</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  )
}
