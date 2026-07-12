'use client';

import { useEffect, useRef, useState } from 'react';

import { type FeedFilters } from '@/features/feed-filters/model/filters';
import { type Message } from '@/entities/message/model/types';
import { Button } from '@/shared/ui/Button';
import { cn } from '@/shared/lib/cn';
import { useSession } from '@/features/auth/ui/SessionProvider';

import { useEditMessageMutation } from '@/features/message-edit/useEditMessageMutation';
import { useDeleteMessageMutation } from '@/features/message-delete/useDeleteMessageMutation';
import { MessageCard } from './MessageCard';
import { MessageEditor } from './MessageEditor';

export interface MessageCardWithActionsProps {
  message: Message & { optimistic?: boolean };
  activeTagFilter?: boolean;
  filters: FeedFilters;
  className?: string;
}

export function MessageCardWithActions({
  message,
  activeTagFilter = false,
  filters,
  className,
}: MessageCardWithActionsProps) {
  const session = useSession();
  const editMutation = useEditMessageMutation(filters);
  const deleteMutation = useDeleteMessageMutation(filters);
  const [deleteConfirming, setDeleteConfirming] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const editButtonRef = useRef<HTMLButtonElement>(null);
  const wasEditingRef = useRef(false);

  const isOptimistic = message.optimistic ?? false;
  const isEditSaving = editMutation.variables?.id === message.id && editMutation.isPending;
  const isDeleting = deleteMutation.variables === message.id && deleteMutation.isPending;
  const isMutating = isEditSaving || isDeleting;

  const canShowActions = message.permissions.canEdit || message.permissions.canDelete;
  const isOwn = message.author.id === session.id;

  useEffect(() => {
    if (!isEditing && wasEditingRef.current) {
      editButtonRef.current?.focus();
    }
    wasEditingRef.current = isEditing;
  }, [isEditing]);

  const handleEditOpen = () => {
    setIsEditing(true);
  };

  const handleEditClose = () => {
    setIsEditing(false);
  };

  const handleEditSave = (content: string) => {
    editMutation.mutate({ id: message.id, input: { content } }, { onSuccess: handleEditClose });
  };

  const handleDelete = () => {
    if (!deleteConfirming) {
      setDeleteConfirming(true);
      setTimeout(() => setDeleteConfirming(false), 3000);
      return;
    }

    deleteMutation.mutate(message.id);
    setDeleteConfirming(false);
  };

  const handleDeleteCancel = () => {
    setDeleteConfirming(false);
  };

  return (
    <div
      className={cn(
        'transition-opacity',
        isOptimistic ? 'opacity-70' : 'opacity-100',
        isMutating && 'pointer-events-none',
        className,
      )}
    >
      {isEditing ? (
        <MessageEditor
          message={message}
          isSaving={isEditSaving}
          onSave={handleEditSave}
          onCancel={handleEditClose}
        />
      ) : (
        <MessageCard
          message={message}
          activeTagFilter={activeTagFilter}
          activeImage={isOwn}
          actions={
            canShowActions && !isEditing ? (
              <div className="flex gap-2.5 font-mono text-xs">
                {message.permissions.canEdit && (
                  <Button
                    ref={editButtonRef}
                    type="button"
                    variant="ghost"
                    disabled={isMutating}
                    onClick={handleEditOpen}
                    className="h-auto px-3 py-1.5 border-2 text-xs"
                  >
                    EDIT
                  </Button>
                )}
                {message.permissions.canDelete && (
                  <Button
                    type="button"
                    variant="ghost"
                    disabled={isMutating}
                    onClick={handleDelete}
                    onBlur={handleDeleteCancel}
                    className="h-auto px-3 py-1.5 border-2 text-xs"
                  >
                    {deleteConfirming ? (
                      'SURE?'
                    ) : (
                      <>
                        {/* The spec abbreviates this to DEL on mobile. */}
                        <span className="md:hidden">DEL</span>
                        <span className="hidden md:inline">DELETE</span>
                      </>
                    )}
                  </Button>
                )}
              </div>
            ) : undefined
          }
        />
      )}
    </div>
  );
}
