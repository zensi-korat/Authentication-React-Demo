import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useConsumerDetail } from "@/features/consumers/get/useConsumerDetail";
import { useDeleteConsumer } from "@/features/consumers/delete/useDeleteConsumer";
import { ACCOUNT_STATUS_CONFIG } from "@/features/consumers/consumers-page.data";

export default function ConsumerDetailPage() {
  const { id = "" } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { consumer, isLoading, isError, error } = useConsumerDetail(id);
  const { mutate: deleteConsumer, isPending: isDeleting } = useDeleteConsumer();
  const [dialogOpen, setDialogOpen] = useState(false);

  async function handleDelete() {
    if (!consumer) return;
    try {
      await deleteConsumer(consumer.id);
      toast.success("Consumer deleted");
      navigate("/consumers");
    } catch {
      toast.error("Failed to delete consumer");
    }
  }

  if (isLoading) {
    return (
      <div className="p-4 md:p-6 space-y-3 max-w-xl">
        <Skeleton className="h-8 w-1/2" />
        <Skeleton className="h-6 w-full" />
        <Skeleton className="h-6 w-full" />
        <Skeleton className="h-6 w-full" />
      </div>
    );
  }

  if (isError || !consumer) {
    return (
      <div className="p-4 md:p-6" role="alert">
        <p className="text-sm font-medium">Failed to load consumer</p>
        <p className="text-sm text-muted-foreground">
          {error instanceof Error ? error.message : "Consumer not found."}
        </p>
      </div>
    );
  }

  const fullName = [consumer.firstName, consumer.middleName, consumer.lastName]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="p-4 md:p-6">
      <Card className="max-w-xl">
        <CardHeader>
          <CardTitle>{fullName}</CardTitle>
          <CardDescription>Consumer #{consumer.consumerNumber}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">First name</p>
              <p className="font-medium">{consumer.firstName}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Middle name</p>
              <p className="font-medium">{consumer.middleName || "—"}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Last name</p>
              <p className="font-medium">{consumer.lastName}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Email</p>
              <p className="font-medium">{consumer.email}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Account status</p>
              <Badge variant={ACCOUNT_STATUS_CONFIG[consumer.accountStatus].variant}>
                {ACCOUNT_STATUS_CONFIG[consumer.accountStatus].label}
              </Badge>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => navigate(`/consumers/${consumer.id}/edit`)}>
            Edit Consumer
          </Button>
          <AlertDialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <AlertDialogTrigger asChild>
              <Button variant="destructive">Delete Consumer</Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete {fullName}?</AlertDialogTitle>
                <AlertDialogDescription>
                  This permanently deletes the consumer record. This action
                  cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={(e) => {
                    e.preventDefault();
                    handleDelete();
                  }}
                  disabled={isDeleting}
                >
                  {isDeleting ? "Deleting..." : "Delete"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
