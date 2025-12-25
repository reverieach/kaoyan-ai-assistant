/**
 * SuperMemo-2 Algorithm Implementation (Anki-like)
 * 
 * References:
 * - https://www.supermemo.com/en/archives1990-2015/english/ol/sm2
 * - https://github.com/ankitects/anki
 */

export type Rating = 0 | 1 | 2 | 3 | 4 | 5;

// 0: Blackout (忘记)
// 1: Incorrect (做错)
// 2: Incorrect but remembered (勉强想起但错了) --- SM2中通常<3都算失败
// 3: Hard (困难)
// 4: Good (一般)
// 5: Easy (简单)

export interface ReviewItem {
    id: string;
    repetition_number: number; // n
    ease_factor: number;       // EF
    interval_days: number;     // I
    mastery_level: number;     // Display metric
}

export interface ReviewResult {
    repetition_number: number;
    ease_factor: number;
    interval_days: number;
    mastery_level: number;
    next_review_at: Date;
}

export function calculateSM2(
    item: ReviewItem,
    quality: Rating
): ReviewResult {
    let { repetition_number, ease_factor, interval_days } = item;

    // 1. Update Ease Factor (EF)
    // EF' = EF + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))
    // EF cannot go below 1.3
    let new_ef = ease_factor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
    if (new_ef < 1.3) new_ef = 1.3;

    let new_repetition = repetition_number;
    let new_interval = interval_days;

    // 2. Update Interval (I)
    if (quality < 3) {
        // Failed grade
        new_repetition = 0;
        new_interval = 1; // Reset to 1 day
    } else {
        // Passing grade
        new_repetition += 1;

        if (new_repetition === 1) {
            new_interval = 1;
        } else if (new_repetition === 2) {
            new_interval = 6;
        } else {
            // I(n) = I(n-1) * EF
            new_interval = Math.round(new_interval * new_ef);
        }
    }

    // Calculate next date
    const next_date = new Date();
    next_date.setDate(next_date.getDate() + new_interval);
    // Set to 4 AM next due day to avoid midnight confusion? Or just simple add.
    // Simple add:

    return {
        repetition_number: new_repetition,
        ease_factor: parseFloat(new_ef.toFixed(2)),
        interval_days: new_interval,
        mastery_level: new_repetition, // Use rep number as mastery level
        next_review_at: next_date
    };
}
