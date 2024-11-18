"use client";

import React from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { handleThreadAutomation } from "@/lib/actions";
import { useRouter } from "next/navigation";
import { Switch } from "./ui/switch";

const threadFormSchema = z.object({
  threads: z.coerce
    .number()
    .min(1, { message: "At least need 1 thread to start" })
    .max(32, { message: "Cannot exced more than 32 threads." }),
  fastmode: z.boolean(),
});

export function RunBrowserManager() {
  const router = useRouter();

  const threadForm = useForm<z.infer<typeof threadFormSchema>>({
    resolver: zodResolver(threadFormSchema),
    defaultValues: {
      threads: 4,
      fastmode: false,
    },
  });

  async function onSubmit(values: z.infer<typeof threadFormSchema>) {
    try {
      await handleThreadAutomation(values.threads, values.fastmode);
      router.push("/threads");
    } catch (error) {
      console.error("Error in thread automation:", error);
      throw new Error("An error occurred during automation.");
    }
  }

  return (
    <>
      <Form {...threadForm}>
        <form onSubmit={threadForm.handleSubmit(onSubmit)}>
          <Card className="w-[250px]">
            <CardHeader>
              <CardTitle>Open browsers</CardTitle>
              <CardDescription>Run multiple browser instance</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid w-full items-center gap-4">
                <FormField
                  name="threads"
                  control={threadForm.control}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Threads</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          placeholder="Number of threads"
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        Number of instance you want to open
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  name="fastmode"
                  control={threadForm.control}
                  render={({ field }) => (
                    <FormItem className="flex gap-2 text-balance flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                      <div className="space-y-0.5">
                        <FormLabel>Fast mode</FormLabel>
                        <FormDescription>
                          Fast mode will hide the browser windows, also blocks
                          request for images & unnecessary things to load
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </CardContent>
            <CardFooter className="flex justify-between">
              <Button
                type="reset"
                variant="outline"
                onClick={() => {
                  threadForm.reset();
                }}
              >
                Reset
              </Button>
              <Button type="submit">Start</Button>
            </CardFooter>
          </Card>
        </form>
      </Form>
    </>
  );
}
