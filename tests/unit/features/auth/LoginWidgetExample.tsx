import { LoginForm } from '@/features/auth/ui/LoginForm';

export const LoginWidgetExample = ({ onSuccess }: { onSuccess: () => void }) => {
  return (
    <div>
      <h1>Login Widget Example</h1>
      This widget from external source (team/library/micro frontend)
      <LoginForm onSuccess={onSuccess} />
    </div>
  );
};
