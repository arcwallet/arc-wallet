/**
 * Password Validation Utility
 * Enforces password strength requirements for wallet security
 */

export interface PasswordStrength {
    isValid: boolean;
    score: number; // 0-4 (weak to strong)
    feedback: string[];
}

/**
 * Validates password strength
 * Requirements:
 * - Minimum 8 characters
 * - At least one lowercase letter
 * - At least one uppercase letter
 * - At least one number
 */
export function validatePassword(password: string): PasswordStrength {
    const feedback: string[] = [];
    let score = 0;

    // Check length
    if (password.length < 8) {
        feedback.push('Must be at least 8 characters');
    } else {
        score++;
        if (password.length >= 12) {
            score++; // Bonus for longer passwords
        }
    }

    // Check for lowercase
    if (!/[a-z]/.test(password)) {
        feedback.push('Must contain at least one lowercase letter (a-z)');
    } else {
        score++;
    }

    // Check for uppercase
    if (!/[A-Z]/.test(password)) {
        feedback.push('Must contain at least one uppercase letter (A-Z)');
    } else {
        score++;
    }

    // Check for numbers
    if (!/[0-9]/.test(password)) {
        feedback.push('Must contain at least one number (0-9)');
    } else {
        score++;
    }

    // Check for special characters (optional but recommended)
    if (/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
        score++; // Bonus for special characters
        if (feedback.length === 0) {
            feedback.push('Strong password! Contains special characters.');
        }
    }

    // Determine if password is valid (minimum requirements met)
    const isValid = password.length >= 8 &&
        /[a-z]/.test(password) &&
        /[A-Z]/.test(password) &&
        /[0-9]/.test(password);

    return {
        isValid,
        score: Math.min(score, 4), // Cap at 4
        feedback,
    };
}

/**
 * Gets a human-readable strength label
 */
export function getPasswordStrengthLabel(score: number): string {
    switch (score) {
        case 0:
        case 1:
            return 'Very Weak';
        case 2:
            return 'Weak';
        case 3:
            return 'Medium';
        case 4:
            return 'Strong';
        default:
            return 'Unknown';
    }
}

/**
 * Gets color for password strength indicator
 */
export function getPasswordStrengthColor(score: number): string {
    switch (score) {
        case 0:
        case 1:
            return '#EF4444'; // red
        case 2:
            return '#F59E0B'; // orange
        case 3:
            return '#10B981'; // green
        case 4:
            return '#059669'; // dark green
        default:
            return '#6B7280'; // gray
    }
}
