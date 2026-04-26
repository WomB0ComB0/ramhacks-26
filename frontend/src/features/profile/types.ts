// Mirror of the user_profiles row shape returned from GET /api/profile.
// Kept in features/profile so consumers don't reach across feature folders.

export interface ProfileRow {
  id: string;
  userId: string;
  major: string | null;
  educationLevel: string | null;
  experienceLevel: string | null;
  interests: string[];
  currentSkills: string[];
  targetIndustries: string[];
  careerGoals: string | null;
  createdAt: string;
}
