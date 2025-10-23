"use client";

import type React from "react";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Loader2,
  Upload,
  Eye,
  Trash2,
  Bot,
  User,
  Send,
  Sparkles,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { PDFViewerModal } from "@/components/pdf-viewer-modal";
import ReactMarkdown from "react-markdown";

interface UserProfile {
  id: number;
  email: string;
  role: string;
  name?: string;
  phone?: string;
  hobbies?: string;
  skills?: string;
  github_username?: string;
  tiktok_handle?: string;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

export default function ProfilePage() {
  const { toast } = useToast();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingResume, setUploadingResume] = useState(false);
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [currentResumeUrl, setCurrentResumeUrl] = useState<string | null>(null);
  const [pdfViewerOpen, setPdfViewerOpen] = useState(false);
  const [githubError, setGithubError] = useState<string | null>(null);
  const [previousGithubUsername, setPreviousGithubUsername] = useState<
    string | null
  >(null);

  // Chat state
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [currentMessage, setCurrentMessage] = useState("");
  const [sendingMessage, setSendingMessage] = useState(false);
  const chatScrollRef = useRef<HTMLDivElement>(null);

  // Check if all mandatory fields are filled
  const isFormValid = () => {
    if (!profile) return false;
    return !!(
      profile.name?.trim() &&
      profile.phone?.trim() &&
      profile.skills?.trim() &&
      profile.hobbies?.trim() &&
      (currentResumeUrl || resumeFile)
    );
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  useEffect(() => {
    if (chatScrollRef.current) {
      const scrollContainer = chatScrollRef.current.querySelector(
        "[data-radix-scroll-area-viewport]"
      );
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
      }
    }
  }, [chatMessages, sendingMessage]);

  const fetchProfile = async () => {
    try {
      const response = await fetch("/api/auth/me");
      const data = await response.json();
      setProfile(data.user);
      // Set the current resume URL from the profile data
      if (data.user?.resume_url) {
        setCurrentResumeUrl(data.user.resume_url);
      }
      // Store the current GitHub username to detect changes
      if (data.user?.github_username) {
        setPreviousGithubUsername(data.user.github_username);
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load profile",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!profile) return;

    // Validate @ symbol in github_username and tiktok_handle
    if (profile.github_username && profile.github_username.includes("@")) {
      toast({
        title: "Invalid GitHub Username",
        description: "Please enter your GitHub username without the @ symbol",
        variant: "destructive",
      });
      return;
    }

    if (profile.tiktok_handle && profile.tiktok_handle.includes("@")) {
      toast({
        title: "Invalid TikTok Handle",
        description: "Please enter your TikTok handle without the @ symbol",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      // First, upload resume if a new one is selected
      const studentId = profile.id;
      let resumeUrl = currentResumeUrl;
      let didUpload = false;
      if (resumeFile) {
        const uploadedUrl = await uploadResume();
        if (uploadedUrl) {
          resumeUrl = uploadedUrl;
          didUpload = true;
        }
      }

      // Then update profile with form data (always save profile info)
      const response = await fetch("/api/auth/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: profile.name,
          phone: profile.phone,
          skills: profile.skills,
          hobbies: profile.hobbies,
          github_username: profile.github_username,
          tiktok_handle: profile.tiktok_handle,
          resume_url: resumeUrl,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to update profile");
      }

      toast({
        title: "✅ Profile saved successfully!",
        description: resumeFile
          ? "Your profile and resume have been updated"
          : "Your profile has been updated",
      });

      // Clear the resume file input after successful upload
      setResumeFile(null);
      if (resumeUrl) {
        setCurrentResumeUrl(resumeUrl);
      }

      // Refresh profile data from server (ensure resume_url is persisted in DB)
      await fetchProfile();

      setGithubError(null); // Clear any previous GitHub errors before processing

      // Check if GitHub username was removed (previous had value, now empty)
      const githubWasRemoved =
        previousGithubUsername && !profile.github_username?.trim();

      // If GitHub username was removed, delete the embeddings
      if (githubWasRemoved) {
        try {
          const deleteResponse = await fetch(
            `http://localhost:8000/github/student/${studentId}`,
            {
              method: "DELETE",
            }
          );

          if (deleteResponse.ok) {
            const deleteData = await deleteResponse.json();
            console.log(`Deleted ${deleteData.count} GitHub embeddings`);
            toast({
              title: "GitHub Data Removed",
              description:
                "Your GitHub portfolio data has been removed from our system.",
            });
          } else {
            console.error("Failed to delete GitHub embeddings");
          }
        } catch (deleteError) {
          console.error("Error deleting GitHub embeddings:", deleteError);
          // Don't show error to user - this is a background cleanup
        }

        // Clear the previous username tracking
        setPreviousGithubUsername(null);
      }

      // If GitHub username is provided, process GitHub portfolio
      if (profile.github_username?.trim()) {
        try {
          const githubResponse = await fetch(
            "http://localhost:8000/github/create",
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                username: profile.github_username.trim(),
                student_id: studentId.toString(),
              }),
            }
          );

          if (!githubResponse.ok) {
            let userFriendlyMessage =
              "Failed to fetch GitHub details. Please check your username and try again.";

            if (githubResponse.status === 404) {
              userFriendlyMessage =
                "GitHub username not found. Please verify the username is correct.";
            } else if (githubResponse.status === 403) {
              userFriendlyMessage =
                "Access denied. Please check your GitHub username permissions.";
            } else if (githubResponse.status === 429) {
              userFriendlyMessage =
                "GitHub API rate limit exceeded. Please try again later.";
            }

            setGithubError(userFriendlyMessage);
            toast({
              title: "GitHub Processing Failed",
              description: userFriendlyMessage,
              variant: "destructive",
            });
          } else {
            setGithubError(null);
            toast({
              title: "GitHub Profile Processed",
              description:
                "Your GitHub repositories have been analyzed and stored.",
            });
            // Update the previous username after successful processing
            setPreviousGithubUsername(profile.github_username.trim());
          }
        } catch (githubError) {
          console.error("GitHub processing error:", githubError);
          const networkError =
            "Unable to connect to GitHub. Please check your internet connection and try again.";
          setGithubError(networkError);
          toast({
            title: "GitHub Error",
            description: networkError,
            variant: "destructive",
          });
        }
      } else {
        setGithubError(null);
      }

      // If we just uploaded a resume, trigger backend vectorisation (after resume_url saved)
      if (didUpload && resumeUrl) {
        try {
          const fd = new FormData();
          fd.append("student_id", studentId.toString());

          const processResponse = await fetch(
            "http://localhost:8000/resume/process",
            {
              method: "POST",
              body: fd,
            }
          );

          if (processResponse.ok) {
            const processData = await processResponse.json();
            console.log("Resume vectorised:", processData);
            toast({
              title: "Resume processed",
              description: "Your resume has been analysed and vectorised",
            });
          } else {
            const contentType =
              processResponse.headers.get("content-type") || "";
            const errBody = contentType.includes("application/json")
              ? await processResponse.json()
              : await processResponse.text();
            console.error("Failed to vectorise resume:", errBody);
            toast({
              title: "Processing incomplete",
              description: "Resume uploaded but vectorisation failed",
              variant: "destructive",
            });
          }
        } catch (vectorError) {
          console.error("Vectorisation error:", vectorError);
        }
      }
    } catch (error) {
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to update profile",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const uploadResume = async (): Promise<string | null> => {
    if (!resumeFile || !profile) return null;

    try {
      const formData = new FormData();
      formData.append("file", resumeFile); // Changed from "resume" to "file"

      const response = await fetch("/api/applications/resume", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to upload resume");
      }

      const data = await response.json();

      toast({
        title: "✅ Resume uploaded",
        description: "Your resume has been uploaded successfully",
      });
      return data.resumeUrl;
    } catch (error) {
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to upload resume",
        variant: "destructive",
      });
      throw error;
    }
  };

  const handleRemoveResume = async () => {
    if (!currentResumeUrl || !profile) return;

    try {
      setSaving(true);

      // First, delete the file from storage bucket
      const deleteResponse = await fetch("/api/applications/resume", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resumePath: currentResumeUrl }),
      });

      if (!deleteResponse.ok) {
        const errorData = await deleteResponse.json();
        throw new Error(
          errorData.error || "Failed to delete resume from storage"
        );
      }

      // Second, delete resume embeddings from vector store
      try {
        const embeddingsDeleteResponse = await fetch(
          `http://localhost:8000/resume/student/${profile.id}`,
          {
            method: "DELETE",
          }
        );

        if (!embeddingsDeleteResponse.ok) {
          console.error(
            "Failed to delete resume embeddings, but continuing..."
          );
          // Don't throw error - we still want to update the profile even if embedding deletion fails
        } else {
          console.log("Resume embeddings deleted successfully");
        }
      } catch (embeddingError) {
        console.error("Error deleting embeddings:", embeddingError);
        // Continue anyway
      }

      // Then update profile to remove resume_url
      const response = await fetch("/api/auth/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: profile.name,
          phone: profile.phone,
          skills: profile.skills,
          hobbies: profile.hobbies,
          resume_url: null, // Remove the resume URL
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to remove resume from profile");
      }

      // Clear local state
      setCurrentResumeUrl(null);
      setResumeFile(null);

      toast({
        title: "✅ Resume removed",
        description:
          "Your resume and embeddings have been removed successfully",
      });

      await fetchProfile();
    } catch (error) {
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to remove resume",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleViewResume = () => {
    if (currentResumeUrl) {
      setPdfViewerOpen(true);
    }
  };

  const handleResumeUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type === "application/pdf") {
      setResumeFile(file);
      toast({
        title: "Resume Selected",
        description: file.name,
      });
    } else {
      toast({
        title: "Error",
        description: "Please select a PDF file",
        variant: "destructive",
      });
    }
  };

  const handleOpenChat = () => {
    if (!profile) return;

    // Initialize chat with welcome message
    setChatMessages([
      {
        role: "assistant",
        content: `Hi ${
          profile.name || "there"
        }! I'm your AI digital twin. I can answer questions about your skills, experience, projects, and help you prepare for interviews. What would you like to know?`,
        timestamp: new Date(),
      },
    ]);
    setChatOpen(true);
  };

  const handleSendMessage = async () => {
    if (!currentMessage.trim() || !profile) return;

    const userMessage: ChatMessage = {
      role: "user",
      content: currentMessage,
      timestamp: new Date(),
    };

    setChatMessages((prev) => [...prev, userMessage]);
    setCurrentMessage("");
    setSendingMessage(true);

    try {
      const response = await fetch("http://localhost:8000/student/chatbot", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          student_id: profile.id.toString(),
          message: userMessage.content,
          temperature: 0.7,
          conversation_history: chatMessages.slice(-4).map((msg) => ({
            role: msg.role,
            content: msg.content,
          })),
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to get response");
      }

      const data = await response.json();

      const aiMessage: ChatMessage = {
        role: "assistant",
        content: data.response || "No response received",
        timestamp: new Date(),
      };

      setChatMessages((prev) => [...prev, aiMessage]);
    } catch (error) {
      console.error("Chat error:", error);
      const errorMessage: ChatMessage = {
        role: "assistant",
        content: "Sorry, I couldn't process your message. Please try again.",
        timestamp: new Date(),
      };
      setChatMessages((prev) => [...prev, errorMessage]);
    } finally {
      setSendingMessage(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="mb-2 text-3xl font-bold">Profile</h1>
        <p className="text-muted-foreground">Manage your account information</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Personal Information</CardTitle>
            <CardDescription>Update your profile details</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Full Name</Label>
              <Input
                id="name"
                value={profile?.name || ""}
                onChange={(e) =>
                  setProfile({ ...profile!, name: e.target.value })
                }
                className="bg-secondary/50"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                value={profile?.email || ""}
                disabled
                className="bg-secondary/50"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                value={profile?.phone || ""}
                onChange={(e) =>
                  setProfile({ ...profile!, phone: e.target.value })
                }
                className="bg-secondary/50"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="skills">Skills</Label>
              <Input
                id="skills"
                value={profile?.skills || ""}
                onChange={(e) =>
                  setProfile({ ...profile!, skills: e.target.value })
                }
                placeholder="JavaScript, React, Node.js"
                className="bg-secondary/50"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="hobbies">Hobbies</Label>
              <Input
                id="hobbies"
                value={profile?.hobbies || ""}
                onChange={(e) =>
                  setProfile({ ...profile!, hobbies: e.target.value })
                }
                placeholder="Reading, Hiking, Photography"
                className="bg-secondary/50"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="github_username">
                GitHub Username (Optional)
              </Label>
              <Input
                id="github_username"
                value={profile?.github_username || ""}
                onChange={(e) => {
                  setProfile({ ...profile!, github_username: e.target.value });
                  setGithubError(null); // Clear error when user types
                }}
                placeholder="without the @"
                className={`bg-secondary/50 ${
                  githubError ? "border-red-500 focus:border-red-500" : ""
                }`}
              />
              {githubError && (
                <p className="text-red-500 text-sm">{githubError}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="tiktok_handle">TikTok Handle (Optional)</Label>
              <Input
                id="tiktok_handle"
                value={profile?.tiktok_handle || ""}
                onChange={(e) =>
                  setProfile({ ...profile!, tiktok_handle: e.target.value })
                }
                placeholder="without the @"
                className="bg-secondary/50"
              />
            </div>
            <Button
              onClick={handleSave}
              disabled={saving || !isFormValid()}
              className="w-full"
            >
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Changes"
              )}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Resume</CardTitle>
            <CardDescription>Upload your resume (PDF format)</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-border bg-secondary/20 p-8 text-center">
              <Upload className="mb-4 h-12 w-12 text-muted-foreground" />
              <p className="mb-2 text-sm font-medium">
                {resumeFile
                  ? resumeFile.name
                  : "Drag and drop or click to upload"}
              </p>
              <p className="mb-4 text-xs text-muted-foreground">
                PDF files only, max 5MB
              </p>
              <input
                type="file"
                accept="application/pdf"
                onChange={handleResumeUpload}
                className="hidden"
                id="resume-upload"
              />
              <label htmlFor="resume-upload">
                <Button variant="outline" asChild>
                  <span>Choose File</span>
                </Button>
              </label>
            </div>
            {resumeFile && (
              <div className="space-y-2">
                <div className="rounded-lg bg-primary/10 p-3 text-sm">
                  <p className="font-medium text-primary">
                    📄 {resumeFile.name}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Ready to upload when you save your profile
                  </p>
                </div>
              </div>
            )}
            {currentResumeUrl && !resumeFile && (
              <div className="space-y-3">
                <div className="rounded-lg bg-green-500/10 p-3 text-sm border border-green-500/20">
                  <p className="font-medium text-green-600">
                    ✅ Resume uploaded
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    You can view, update, or remove your resume
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={handleViewResume}
                    className="flex-1"
                  >
                    <Eye className="mr-2 h-4 w-4" />
                    View Resume
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleRemoveResume}
                    disabled={saving}
                    className="flex-1 text-red-600 hover:text-red-700 hover:bg-red-50"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Remove Resume
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bot className="h-5 w-5 text-primary" />
              AI Interview Assistant
            </CardTitle>
            <CardDescription>
              Practice interviews with your digital twin
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Chat with an AI version of yourself trained on your resume and
                GitHub projects. Practice answering tough interview questions
                and get personalized feedback.
              </p>
              <Button
                onClick={handleOpenChat}
                className="w-full"
                disabled={!profile || !currentResumeUrl}
              >
                <Sparkles className="mr-2 h-4 w-4" />
                Start Interview Practice
              </Button>
              {(!profile || !currentResumeUrl) && (
                <p className="text-xs text-muted-foreground">
                  Complete your profile and upload a resume to unlock the AI
                  assistant
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Chat Sheet */}
      <Sheet open={chatOpen} onOpenChange={setChatOpen}>
        <SheetContent
          side="right"
          className="w-full sm:w-1/4 sm:max-w-none flex flex-col p-0"
        >
          <SheetHeader className="p-6 pb-4 border-b border-border">
            <SheetTitle className="flex items-center gap-2">
              <Bot className="h-5 w-5 text-primary" />
              AI Interview Assistant
            </SheetTitle>
            <SheetDescription>
              Practice with your digital twin - {profile?.name || "Student"}
            </SheetDescription>
          </SheetHeader>

          <div className="flex-1 overflow-hidden" ref={chatScrollRef}>
            <ScrollArea className="h-full p-6">
              <div className="space-y-4">
                {chatMessages.map((message, index) => (
                  <div
                    key={index}
                    className={`flex gap-3 ${
                      message.role === "user" ? "justify-end" : "justify-start"
                    }`}
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
                          <ReactMarkdown>{message.content}</ReactMarkdown>
                        </div>
                      ) : (
                        <p className="text-sm">{message.content}</p>
                      )}
                      <p className="text-xs mt-1 opacity-70">
                        {message.timestamp.toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
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

          <div className="p-6 pt-4 border-t border-border">
            <div className="flex gap-2">
              <Input
                placeholder="Ask about your experience, skills, or projects..."
                value={currentMessage}
                onChange={(e) => setCurrentMessage(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
                disabled={sendingMessage}
                className="flex-1"
              />
              <Button
                onClick={handleSendMessage}
                disabled={!currentMessage.trim() || sendingMessage}
                size="icon"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* PDF Viewer Modal */}
      <PDFViewerModal
        isOpen={pdfViewerOpen}
        onClose={() => setPdfViewerOpen(false)}
        pdfUrl={currentResumeUrl || ""}
        title="My Resume"
      />
    </div>
  );
}
