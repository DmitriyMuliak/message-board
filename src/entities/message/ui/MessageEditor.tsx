import { useEffect, type KeyboardEvent } from 'react';
import { useForm, Controller, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

import { messageSchema, type Message } from '@/entities/message/model/types';
import { Button } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import { Textarea } from '@/shared/ui/Textarea';
import { cn } from '@/shared/lib/cn';

const editContentSchema = messageSchema.pick({ content: true });
const maxMessageLength = 240;

interface EditFormData {
  content: string;
}

export interface MessageEditorProps {
  message: Message;
  isSaving: boolean;
  onSave: (content: string) => void;
  onCancel: () => void;
}

export function MessageEditor({ message, isSaving, onSave, onCancel }: MessageEditorProps) {
  const { control, handleSubmit, reset, setFocus } = useForm<EditFormData>({
    resolver: zodResolver(editContentSchema),
    defaultValues: { content: message.content },
    mode: 'onChange',
  });

  const editContent = useWatch({ control, name: 'content' });
  const editCharCount = editContent.trim().length;
  const isEditValid = editCharCount > 0 && editCharCount <= maxMessageLength;
  const isEditOversized = editCharCount > maxMessageLength;

  const originalContent = message.content.trim();
  const isUnchanged = editContent.trim() === originalContent;

  useEffect(() => {
    setFocus('content');
  }, [setFocus]);

  const handleCancel = () => {
    reset({ content: message.content });
    onCancel();
  };

  const handleSaveSubmit = (data: EditFormData) => {
    const trimmed = data.content.trim();
    if (trimmed.length === 0 || trimmed.length > maxMessageLength || isSaving) {
      return;
    }
    // Nothing actually changed: leave edit mode instead of PATCHing the same content
    // back. The guard lives here, not only on the disabled Save button, because
    // ⌘/Ctrl+Enter submits the form directly and never consults that button.
    if (trimmed === originalContent) {
      onCancel();
      return;
    }
    onSave(trimmed);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLFormElement>) => {
    if (isSaving) {
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      handleCancel();
    } else if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
      event.preventDefault();
      void handleSubmit(handleSaveSubmit)();
    }
  };

  return (
    <Card role="group" aria-label={`Editing message from ${message.author.name}`}>
      <form
        onSubmit={handleSubmit(handleSaveSubmit)}
        onKeyDown={handleKeyDown}
        className="flex flex-col gap-3"
      >
        <div className="flex items-center justify-between">
          <label
            htmlFor={`message-edit-${message.id}`}
            className="font-mono text-[11px] font-bold tracking-wide text-muted uppercase"
          >
            Edit message
          </label>
          <span
            className={cn(
              'font-mono text-xs',
              editCharCount === 0
                ? 'text-muted'
                : isEditOversized
                  ? 'font-bold text-ink'
                  : 'text-faint',
            )}
            aria-live="polite"
            role="status"
          >
            {editCharCount}/{maxMessageLength}
          </span>
        </div>
        <Controller
          name="content"
          control={control}
          render={({ field }) => (
            <Textarea
              {...field}
              id={`message-edit-${message.id}`}
              label="Edit message"
              hideLabel
              disabled={isSaving}
              className="font-sans text-sm max-h-32"
            />
          )}
        />
        <div className="flex gap-2.5 font-mono text-xs">
          <Button
            type="submit"
            variant="ghost"
            disabled={!isEditValid || isUnchanged || isSaving}
            aria-busy={isSaving}
            className="h-auto px-3 py-1.5 border-2 text-xs"
          >
            {isSaving ? 'SAVING…' : 'SAVE'}
          </Button>
          <Button
            type="button"
            variant="ghost"
            disabled={isSaving}
            onClick={handleCancel}
            className="h-auto px-3 py-1.5 border-2 text-xs"
          >
            CANCEL
          </Button>
        </div>
      </form>
    </Card>
  );
}
