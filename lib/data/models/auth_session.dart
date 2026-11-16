class AuthSession {
  const AuthSession({
    required this.id,
    required this.name,
    required this.email,
    required this.role,
    required this.arm,
  });

  final String id;
  final String name;
  final String email;
  final String role;
  final String arm;

  factory AuthSession.fromJson(Map<String, dynamic> json) => AuthSession(
    id: json['id'] as String,
    name: json['name'] as String,
    email: json['email'] as String,
    role: json['role'] as String,
    arm: json['arm'] as String,
  );
}
