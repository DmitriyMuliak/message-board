'use client';

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import { Button } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import { useToast } from '@/shared/ui/Toaster';

// The HOST renders the child widget directly. It does NOT mount the child's
// provider — `ConnectedMessageSpotlight` does that in production, and the
// spotlight kit's `wrap()` does it in tests. Same composition, two bindings.
import { AuthorCard } from '@/features/author-card/ui/AuthorCard';

import { useSpotlightPort } from '../api/spotlight.port';
import { spotlightKeys, useSpotlightQuery } from '../api/spotlight.queries';
import type { Spotlight } from '../model/types';

export function MessageSpotlight({ messageId }: { messageId: string }) {
  const { data: message, isPending, isError } = useSpotlightQuery(messageId);
  const { addToast } = useToast();
  const queryClient = useQueryClient();
  const spotlightPort = useSpotlightPort();

  // Only the in-flight flag is local. `pinned` lives in the query cache keyed by
  // `messageId` — a local `justPinned` would survive a change of `messageId`
  // (React keeps this mounted) and render the NEXT message as already pinned.
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (isPending) {
    return (
      <Card data-testid="message-spotlight" role="status" aria-busy="true">
        Loading message…
      </Card>
    );
  }

  if (isError || !message) {
    return (
      <Card data-testid="message-spotlight">
        <p role="alert">Couldn&apos;t load this message.</p>
      </Card>
    );
  }

  const onPin = async () => {
    setIsSubmitting(true);
    try {
      const result = await spotlightPort.pin({ messageId });

      if (result.success) {
        queryClient.setQueryData<Spotlight>(spotlightKeys.byId(messageId), (previous) =>
          previous ? { ...previous, pinned: true } : previous,
        );
        addToast({ message: 'Message pinned to the top of the feed.', variant: 'default' });
        return;
      }

      addToast({ message: result.error, variant: 'error' });
    } catch {
      addToast({ message: 'Something went wrong. Please try again.', variant: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card data-testid="message-spotlight">
      <p>{message.body}</p>
      <AuthorCard authorId={message.authorId} />
      <Button onClick={onPin} disabled={message.pinned || isSubmitting} aria-busy={isSubmitting}>
        {message.pinned ? 'Pinned' : isSubmitting ? 'Pinning…' : 'Pin'}
      </Button>
    </Card>
  );
}
