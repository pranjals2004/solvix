CREATE TABLE leaderboard_weekly_questions (
  week_start date NOT NULL,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  submission_id uuid NOT NULL UNIQUE REFERENCES submissions(id) ON DELETE CASCADE,
  first_correct_at timestamptz(3) NOT NULL,
  PRIMARY KEY (week_start, user_id, question_id)
);
CREATE INDEX leaderboard_weekly_user_idx
  ON leaderboard_weekly_questions (week_start, user_id, first_correct_at);
