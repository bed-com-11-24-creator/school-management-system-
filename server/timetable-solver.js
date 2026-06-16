/**
 * Clash-Free Timetable Generator Solver
 * Uses a Backtracking Constraint Satisfaction algorithm.
 */

export function generateTimetable(input) {
  const {
    classes,       // Array of strings: ['Form 1', 'Form 2']
    subjects,      // Array of objects: [{ name: 'Mathematics', periods: 4, teacher: 'Mr. Phiri' }, ...]
    days,          // Array of strings: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']
    slotsPerDay,   // Number: 5 (e.g. 5 teaching periods per day)
    maxSameSubjectPerDay = 2 // Max periods of same subject for a class per day
  } = input;

  // Initialize timetable structure: timetable[className][day][slot] = { subject, teacher }
  const timetable = {};
  classes.forEach(c => {
    timetable[c] = {};
    days.forEach(d => {
      timetable[c][d] = Array(slotsPerDay).fill(null);
    });
  });

  // Flatten subjects to schedule into individual lesson items
  // A lesson represents a single period of a subject for a class
  const lessons = [];
  classes.forEach(c => {
    // Filter subjects assigned to this class
    subjects.forEach(sub => {
      // Check if this subject is for this class
      if (sub.class === c) {
        for (let i = 0; i < sub.periods; i++) {
          lessons.push({
            id: `${c}-${sub.name}-${i}`,
            className: c,
            subject: sub.name,
            teacher: sub.teacher,
            venue: sub.venue || null
          });
        }
      }
    });
  });

  // Sort lessons: prioritize classes or teachers with most periods (heuristics to speed up search)
  lessons.sort((a, b) => {
    const aCount = lessons.filter(l => l.teacher === a.teacher).length;
    const bCount = lessons.filter(l => l.teacher === b.teacher).length;
    return bCount - aCount; // teachers with more periods first
  });

  const totalSlotsAvailable = classes.length * days.length * slotsPerDay;
  if (lessons.length > totalSlotsAvailable) {
    return {
      success: false,
      error: `Over-allocated. Total requested periods (${lessons.length}) exceeds available slots (${totalSlotsAvailable}).`
    };
  }

  // Count how many times a subject is scheduled for a class on a specific day
  const getSubjectDayCount = (className, day, subject) => {
    let count = 0;
    for (let slot = 0; slot < slotsPerDay; slot++) {
      if (timetable[className][day][slot]?.subject === subject) {
        count++;
      }
    }
    return count;
  };

  // Check if a placement is valid under all constraints
  const isValid = (className, day, slot, subject, teacher, venue) => {
    // 1. Check if class slot is already occupied
    if (timetable[className][day][slot] !== null) {
      return false;
    }

    // 2. Check if the teacher is already teaching another class in the same slot (Teacher clash)
    for (const c of classes) {
      if (timetable[c][day][slot] !== null && timetable[c][day][slot].teacher === teacher) {
        return false;
      }
    }

    // 3. Check if the venue is already occupied by another class in the same slot (Venue clash)
    if (venue) {
      for (const c of classes) {
        if (timetable[c][day][slot] !== null && timetable[c][day][slot].venue === venue) {
          return false;
        }
      }
    }

    // 4. Prevent excessive periods of the same subject on the same day for a class (Subject bunching)
    if (getSubjectDayCount(className, day, subject) >= maxSameSubjectPerDay) {
      return false;
    }

    return true;
  };

  // Backtracking solver
  const solve = (lessonIndex) => {
    if (lessonIndex >= lessons.length) {
      return true; // All lessons placed successfully!
    }

    const lesson = lessons[lessonIndex];
    const { className, subject, teacher, venue } = lesson;

    // Try placing this lesson in all available slots
    // Shuffle slots/days to distribute them nicely
    for (const day of days) {
      for (let slot = 0; slot < slotsPerDay; slot++) {
        if (isValid(className, day, slot, subject, teacher, venue)) {
          // Place lesson
          timetable[className][day][slot] = { subject, teacher, venue };

          // Recurse to place next lesson
          if (solve(lessonIndex + 1)) {
            return true;
          }

          // Backtrack if failed
          timetable[className][day][slot] = null;
        }
      }
    }

    return false; // Could not place this lesson in any slot
  };

  const success = solve(0);

  if (success) {
    return {
      success: true,
      timetable
    };
  } else {
    // Diagnose what failed
    // Find unplaced lessons by running a dry run and identifying where the blocker is
    return {
      success: false,
      error: 'Clash detected! The requested scheduling contains constraints that cannot be satisfied. Check for teacher over-scheduling or slot conflicts.'
    };
  }
}
