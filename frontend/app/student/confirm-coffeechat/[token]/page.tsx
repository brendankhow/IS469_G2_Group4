"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Loader2, Check, AlertCircle, Clock, Coffee } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface CoffeeChatSlot {
  date: string;
  time: string;
}

interface ConfirmationData {
  studentName: string;
  recruiterName: string;
  recruiterEmail: string;
  slots: CoffeeChatSlot[];
  confirmedSlot: { date: string; time: string; confirmed_at: string } | null;
  isExpired: boolean;
  isValid: boolean;
}

export default function ConfirmCoffeeChatPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [data, setData] = useState<ConfirmationData | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<CoffeeChatSlot | null>(null);
  const token = params.token as string;

  useEffect(() => {
    fetchConfirmationData();
  }, [token]);

  const fetchConfirmationData = async () => {
    try {
      const response = await fetch(`/api/student/confirm-coffeechat/${token}`);
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to load confirmation data");
      }

      setData(result);
    } catch (error) {
      toast({
        title: "Error",
        description:
          error instanceof Error
            ? error.message
            : "Failed to load coffee chat details",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmSlot = async () => {
    if (!selectedSlot) return;

    setConfirming(true);
    try {
      const response = await fetch(`/api/student/confirm-coffeechat/${token}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          selectedSlot,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to confirm coffee chat");
      }

      toast({
        title: "Coffee Chat Scheduled!",
        description:
          "A confirmation email has been sent to you with calendar invitation.",
        duration: 5000,
      });

      // Wait a moment to show the toast, then redirect
      setTimeout(() => {
        router.push("/student/interviews");
      }, 2000);
    } catch (error) {
      toast({
        title: "Error",
        description:
          error instanceof Error
            ? error.message
            : "Failed to confirm coffee chat",
        variant: "destructive",
      });
      setConfirming(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!data || !data.isValid) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-5 w-5" />
              Invalid Link
            </CardTitle>
            <CardDescription>
              This confirmation link is invalid or has expired.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Please contact the recruiter if you need a new invitation.
            </p>
            <Button
              onClick={() => router.push("/student/dashboard")}
              className="w-full"
            >
              Go to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (data.confirmedSlot) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Card className="w-full max-w-md border-green-500 border-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-green-600">
              <Check className="h-5 w-5" />
              Coffee Chat Confirmed!
            </CardTitle>
            <CardDescription>
              Your coffee chat has been successfully scheduled
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg bg-green-50 dark:bg-green-950 p-4 space-y-3">
              <div className="flex items-center gap-2 mb-2">
                <Coffee className="h-5 w-5 text-green-600" />
                <h3 className="font-semibold text-green-700 dark:text-green-300">
                  Coffee Chat Details
                </h3>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">With</p>
                <p className="font-semibold">{data.recruiterName}</p>
              </div>
              <div className="border-t pt-3">
                <p className="text-xs text-muted-foreground">Date & Time</p>
                <p className="font-semibold text-lg">
                  {new Date(data.confirmedSlot.date).toLocaleDateString(
                    "en-US",
                    {
                      weekday: "long",
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    }
                  )}
                </p>
                <p className="font-semibold text-lg">
                  {data.confirmedSlot.time} (30 minutes)
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Confirmed At</p>
                <p className="text-sm">
                  {new Date(data.confirmedSlot.confirmed_at).toLocaleString()}
                </p>
              </div>
            </div>

            <div className="rounded-lg bg-secondary p-4">
              <p className="text-sm">
                <strong>📧 Next Steps:</strong>
              </p>
              <ul className="text-sm text-muted-foreground mt-2 space-y-1 ml-4 list-disc">
                <li>Check your email for a calendar invitation</li>
                <li>Add the coffee chat to your calendar</li>
                <li>
                  The recruiter will share location details closer to the date
                </li>
                <li>Prepare some questions or topics to discuss!</li>
              </ul>
            </div>

            <Button
              onClick={() => router.push("/student/dashboard")}
              className="w-full"
            >
              Back to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4 bg-secondary/20">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Coffee className="h-6 w-6 text-green-600" />
            Select Your Coffee Chat Time
          </CardTitle>
          <CardDescription>
            Choose your preferred time slot for the coffee chat
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Recruiter Info */}
          <div className="rounded-lg bg-secondary/50 p-4 space-y-2">
            <div>
              <p className="text-xs text-muted-foreground">Coffee Chat With</p>
              <p className="font-semibold text-lg">{data.recruiterName}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Recruiter Email</p>
              <p className="font-medium">{data.recruiterEmail}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Your Name</p>
              <p className="font-medium">{data.studentName}</p>
            </div>
          </div>

          {/* Available Slots */}
          <div>
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Available Time Slots ({data.slots.length} options)
            </h3>
            <div className="grid gap-3">
              {data.slots.map((slot, index) => {
                const isSelected =
                  selectedSlot?.date === slot.date &&
                  selectedSlot?.time === slot.time;
                const slotDate = new Date(slot.date);

                return (
                  <Button
                    key={index}
                    variant={isSelected ? "default" : "outline"}
                    className="h-auto p-4 justify-start flex-col items-start"
                    onClick={() => setSelectedSlot(slot)}
                  >
                    <div className="flex items-center gap-2 w-full">
                      {isSelected && (
                        <Check className="h-4 w-4 flex-shrink-0" />
                      )}
                      <div className="flex-1 text-left">
                        <div className="font-semibold">
                          {slotDate.toLocaleDateString("en-US", {
                            weekday: "long",
                            year: "numeric",
                            month: "long",
                            day: "numeric",
                          })}
                        </div>
                        <div
                          className={`text-sm ${
                            isSelected ? "opacity-90" : "opacity-70"
                          }`}
                        >
                          {slot.time} -{" "}
                          {(() => {
                            const [hours, minutes] = slot.time.split(":");
                            const endDate = new Date();
                            endDate.setHours(
                              parseInt(hours),
                              parseInt(minutes) + 30,
                              0,
                              0
                            );
                            return endDate.toTimeString().slice(0, 5);
                          })()}{" "}
                          (30 minutes)
                        </div>
                      </div>
                    </div>
                  </Button>
                );
              })}
            </div>
          </div>

          {/* Confirmation Section */}
          {selectedSlot && (
            <div className="rounded-lg bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 p-4">
              <p className="text-sm font-semibold text-green-700 dark:text-green-300 mb-2">
                Selected Time:
              </p>
              <p className="text-sm text-green-800 dark:text-green-200">
                {new Date(selectedSlot.date).toLocaleDateString("en-US", {
                  weekday: "long",
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}{" "}
                at {selectedSlot.time}
              </p>
            </div>
          )}

          <Button
            className="w-full"
            onClick={handleConfirmSlot}
            disabled={!selectedSlot || confirming}
            size="lg"
          >
            {confirming ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Confirming Coffee Chat...
              </>
            ) : (
              <>
                <Check className="mr-2 h-4 w-4" />
                Confirm Coffee Chat Time
              </>
            )}
          </Button>

          <p className="text-xs text-muted-foreground text-center">
            By confirming, you agree to attend the coffee chat at the selected
            time. You'll receive a calendar invitation via email.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
