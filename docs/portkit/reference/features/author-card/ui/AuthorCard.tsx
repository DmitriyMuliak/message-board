'use client';

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';

// Your own design-system primitives. Nothing here is specific to this approach
// except that `Button` renders `aria-busy` while loading — see the driver.
import { Avatar } from '@/shared/ui/Avatar';
import { Button } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import { useToast } from '@/shared/ui/Toaster';

import { useAuthorPort } from '../api/author.port';
import { authorKeys, useAuthorQuery } from '../api/author.queries';
import type { AuthorProfile } from '../model/types';

export function AuthorCard({ authorId }: { authorId: string }) {
  const { data: author, isPending, isError } = useAuthorQuery(authorId);
  const { addToast } = useToast();
  const queryClient = useQueryClient();

  // The dependency arrives from context. There is no import of the action here,
  // and that single fact is what removes every hoisting rule from the tests.
  const authorPort = useAuthorPort();

  // Only the IN-FLIGHT flag is local. Follow state lives in the query cache,
  // keyed by `authorId` — a local `justFollowed` boolean would survive a change
  // of `authorId` (React keeps the component mounted) and render the NEXT
  // author as already followed. See `03-architecture.md` §10.
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (isPending) {
    return (
      <Card data-testid="author-card" role="status" aria-busy="true">
        Loading author…
      </Card>
    );
  }

  if (isError || !author) {
    return (
      <Card data-testid="author-card">
        <p role="alert">Couldn&apos;t load this author.</p>
      </Card>
    );
  }

  const onFollow = async () => {
    setIsSubmitting(true);
    try {
      const result = await authorPort.follow({ authorId });

      if (result.success) {
        queryClient.setQueryData<AuthorProfile>(authorKeys.byId(authorId), (previous) =>
          previous
            ? { ...previous, isFollowedByViewer: true, followers: result.followers }
            : previous,
        );
        addToast({ message: `You are now following ${author.name}.`, variant: 'default' });
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
    <Card data-testid="author-card" className="flex items-center gap-3">
      <Avatar name={author.name} />
      <div className="min-w-0 flex-1">
        <p className="truncate font-bold">{author.name}</p>
        <p className="truncate text-muted">@{author.handle}</p>
        <p data-testid="author-followers">{author.followers} followers</p>
      </div>
      <Button
        onClick={onFollow}
        disabled={author.isFollowedByViewer || isSubmitting}
        aria-busy={isSubmitting}
        variant={author.isFollowedByViewer ? 'ghost' : 'accent'}
      >
        {author.isFollowedByViewer ? 'Following' : isSubmitting ? 'Following…' : 'Follow'}
      </Button>
    </Card>
  );
}
