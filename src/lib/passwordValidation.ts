export interface PasswordRules {
  minLength: boolean;    // 8+ characters
  hasUppercase: boolean; // A-Z
  hasLowercase: boolean; // a-z
  hasNumber: boolean;    // 0-9
  hasSpecial: boolean;   // !@#$% etc.
}

export interface PasswordStrength {
  rules: PasswordRules;
  score: number;         // 0–5
  label: 'Too short' | 'Weak' | 'Fair' | 'Good' | 'Strong' | 'Very strong';
  color: string;
  isValid: boolean;      // all rules pass
}

export function checkPassword(password: string): PasswordStrength {
  const rules: PasswordRules = {
    minLength:    password.length >= 8,
    hasUppercase: /[A-Z]/.test(password),
    hasLowercase: /[a-z]/.test(password),
    hasNumber:    /[0-9]/.test(password),
    hasSpecial:   /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/.test(password),
  };

  const score = Object.values(rules).filter(Boolean).length;

  const labels: PasswordStrength['label'][] = [
    'Too short', 'Weak', 'Fair', 'Good', 'Strong', 'Very strong',
  ];
  const colors = ['#ef4444', '#f97316', '#eab308', '#84cc16', '#22c55e', '#10b981'];

  return {
    rules,
    score,
    label: labels[score],
    color: colors[score],
    isValid: Object.values(rules).every(Boolean),
  };
}

export const RULE_LABELS: Record<keyof PasswordRules, string> = {
  minLength:    'At least 8 characters',
  hasUppercase: 'One uppercase letter (A–Z)',
  hasLowercase: 'One lowercase letter (a–z)',
  hasNumber:    'One number (0–9)',
  hasSpecial:   'One special character (!@#$%...)',
};
