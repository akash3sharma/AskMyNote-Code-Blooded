import Link from "next/link";
import { BrainCircuit, MessageCircle, NotebookPen, Repeat2, UploadCloud } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type SubjectCardProps = {
  id: string;
  name: string;
  slot: number;
  fileCount?: number;
};

export function SubjectCard({ id, name, slot, fileCount = 0 }: SubjectCardProps) {
  return (
    <Card className="group border-zinc-200 transition hover:-translate-y-0.5 hover:shadow-md">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>{name}</CardTitle>
          <Badge>{`Subject ${slot}`}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-zinc-600">{fileCount > 0 ? `${fileCount} files uploaded` : "No files uploaded yet"}</p>
        <div className="grid grid-cols-2 gap-2">
          <Button asChild size="sm" variant="secondary">
            <Link href={`/app/subjects/${id}`}>
              <UploadCloud className="h-3.5 w-3.5" />
              Upload
            </Link>
          </Button>
          <Button asChild size="sm" variant="secondary">
            <Link href={`/app/chat/${id}`}>
              <MessageCircle className="h-3.5 w-3.5" />
              Chat
            </Link>
          </Button>
          <Button asChild size="sm" variant="secondary">
            <Link href={`/app/study/${id}`}>
              <NotebookPen className="h-3.5 w-3.5" />
              Study
            </Link>
          </Button>
          <Button asChild size="sm" variant="secondary">
            <Link href={`/app/lab/${id}`}>
              <BrainCircuit className="h-3.5 w-3.5" />
              AI Lab
            </Link>
          </Button>
          <Button asChild size="sm" variant="secondary" className="col-span-2">
            <Link href={`/app/review/${id}`}>
              <Repeat2 className="h-3.5 w-3.5" />
              Review
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
