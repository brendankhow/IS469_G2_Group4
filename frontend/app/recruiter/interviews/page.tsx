"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Calendar, Coffee, Loader2, CheckCircle2, Clock, ExternalLink } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

interface Interview {
  id: string
  student_id: string
  student_name: string
  student_email: string
  job_title: string
  proposed_slots: Array<{ date: string; time: string }>
  confirmed_slot: { date: string; time: string; confirmed_at: string } | null
  interview_status: string
  created_at: string
}

interface CoffeeChat {
  id: string
  student_id: string
  student_name: string
  student_email: string
  proposed_slots: Array<{ date: string; time: string }>
  confirmed_slot: { date: string; time: string; confirmed_at: string } | null
  coffeechat_status: string
  created_at: string
}

export default function InterviewsPage() {
  const { toast } = useToast()
  const [interviews, setInterviews] = useState<Interview[]>([])
  const [coffeeChats, setCoffeeChats] = useState<CoffeeChat[]>([])
  const [loadingInterviews, setLoadingInterviews] = useState(true)
  const [loadingCoffeeChats, setLoadingCoffeeChats] = useState(true)

  useEffect(() => {
    fetchInterviews()
    fetchCoffeeChats()
  }, [])

  const fetchInterviews = async () => {
    try {
      const response = await fetch('/api/recruiter/interviews')
      if (response.ok) {
        const data = await response.json()
        setInterviews(data.interviews || [])
      }
    } catch (error) {
      console.error('Failed to fetch interviews:', error)
      toast({
        title: "Error",
        description: "Failed to load interviews",
        variant: "destructive",
      })
    } finally {
      setLoadingInterviews(false)
    }
  }

  const fetchCoffeeChats = async () => {
    try {
      const response = await fetch('/api/recruiter/coffeechats')
      if (response.ok) {
        const data = await response.json()
        setCoffeeChats(data.coffeeChats || [])
      }
    } catch (error) {
      console.error('Failed to fetch coffee chats:', error)
      toast({
        title: "Error",
        description: "Failed to load coffee chats",
        variant: "destructive",
      })
    } finally {
      setLoadingCoffeeChats(false)
    }
  }

  const getStatusBadge = (status: string, confirmed: boolean) => {
    if (confirmed) {
      return <Badge className="bg-green-500">Confirmed</Badge>
    }
    if (status === 'pending') {
      return <Badge variant="secondary">Pending</Badge>
    }
    return <Badge variant="outline">{status}</Badge>
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="mb-2 text-3xl font-bold">Interviews & Coffee Chats</h1>
        <p className="text-muted-foreground">
          Manage your scheduled interviews and coffee chats
        </p>
      </div>

      <Tabs defaultValue="interviews" className="space-y-6">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="interviews" className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Interviews ({interviews.length})
          </TabsTrigger>
          <TabsTrigger value="coffee-chats" className="flex items-center gap-2">
            <Coffee className="h-4 w-4" />
            Coffee Chats ({coffeeChats.length})
          </TabsTrigger>
        </TabsList>

        {/* Interviews Tab */}
        <TabsContent value="interviews" className="space-y-4">
          {loadingInterviews ? (
            <div className="flex justify-center items-center h-64">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : interviews.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center h-64">
                <Calendar className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No interviews scheduled yet</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {interviews.map((interview) => (
                <Card key={interview.id}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <CardTitle className="text-lg">
                          {interview.student_name}
                        </CardTitle>
                        <CardDescription>
                          {interview.job_title}
                        </CardDescription>
                      </div>
                      {getStatusBadge(
                        interview.interview_status,
                        !!interview.confirmed_slot
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {interview.confirmed_slot ? (
                      <div className="rounded-lg border-2 border-green-500 bg-green-50 dark:bg-green-950 p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <CheckCircle2 className="h-4 w-4 text-green-600" />
                          <p className="text-sm font-semibold text-green-700 dark:text-green-300">
                            Confirmed Interview
                          </p>
                        </div>
                        <p className="text-sm font-medium">
                          {new Date(interview.confirmed_slot.date).toLocaleDateString("en-US", {
                            weekday: "long",
                            month: "long",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {interview.confirmed_slot.time}
                        </p>
                      </div>
                    ) : (
                      <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <Clock className="h-4 w-4 text-primary" />
                          <p className="text-sm font-semibold text-primary">
                            Waiting for Confirmation
                          </p>
                        </div>
                        <div className="space-y-1">
                          {interview.proposed_slots.map((slot, index) => (
                            <p key={index} className="text-xs text-muted-foreground">
                              • {new Date(slot.date).toLocaleDateString("en-US", {
                                weekday: "short",
                                month: "short",
                                day: "numeric",
                              })} at {slot.time}
                            </p>
                          ))}
                        </div>
                      </div>
                    )}
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span>{interview.student_email}</span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Coffee Chats Tab */}
        <TabsContent value="coffee-chats" className="space-y-4">
          {loadingCoffeeChats ? (
            <div className="flex justify-center items-center h-64">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : coffeeChats.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center h-64">
                <Coffee className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No coffee chats scheduled yet</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {coffeeChats.map((chat) => (
                <Card key={chat.id}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <CardTitle className="text-lg">
                          {chat.student_name}
                        </CardTitle>
                        <CardDescription>
                          Coffee Chat
                        </CardDescription>
                      </div>
                      {getStatusBadge(
                        chat.coffeechat_status,
                        !!chat.confirmed_slot
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {chat.confirmed_slot ? (
                      <div className="rounded-lg border-2 border-green-500 bg-green-50 dark:bg-green-950 p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <CheckCircle2 className="h-4 w-4 text-green-600" />
                          <p className="text-sm font-semibold text-green-700 dark:text-green-300">
                            Confirmed Coffee Chat
                          </p>
                        </div>
                        <p className="text-sm font-medium">
                          {new Date(chat.confirmed_slot.date).toLocaleDateString("en-US", {
                            weekday: "long",
                            month: "long",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {chat.confirmed_slot.time}
                        </p>
                      </div>
                    ) : (
                      <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <Clock className="h-4 w-4 text-primary" />
                          <p className="text-sm font-semibold text-primary">
                            Waiting for Confirmation
                          </p>
                        </div>
                        <div className="space-y-1">
                          {chat.proposed_slots.map((slot, index) => (
                            <p key={index} className="text-xs text-muted-foreground">
                              • {new Date(slot.date).toLocaleDateString("en-US", {
                                weekday: "short",
                                month: "short",
                                day: "numeric",
                              })} at {slot.time}
                            </p>
                          ))}
                        </div>
                      </div>
                    )}
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span>{chat.student_email}</span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
