"use client";

import { FormEvent, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type SubjectCreateFormProps = {
  disabled: boolean;
  onCreated: () => Promise<void> | void;
};

export function SubjectCreateForm({ disabled, onCreated }: SubjectCreateFormProps) {
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) return;

    setLoading(true);
    try {
      const response = await fetch("/api/subjects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });

      const payload = await response.json();
      if (!response.ok) {
        toast.error(payload.error || "Could not create subject");
        return;
      }

      toast.success("Subject created");
      setName("");
      await onCreated();
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-2 sm:flex-row">
      <Input
        placeholder={disabled ? "3 subjects reached" : "Enter subject name"}
        value={name}
        onChange={(event) => setName(event.target.value)}
        disabled={disabled || loading}
      />
      <Button type="submit" disabled={disabled || loading}>
        {loading ? "Creating..." : "Add Subject"}
      </Button>
    </form>
  );
}
