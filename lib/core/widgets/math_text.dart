import 'package:flutter/material.dart';
import 'package:flutter_math_fork/flutter_math.dart';

/// Renders the platform's LaTeX delimiters natively with flutter_math_fork.
class MathText extends StatelessWidget {
  const MathText(this.text, {super.key, this.style});

  final String text;
  final TextStyle? style;

  static final RegExp _mathPattern = RegExp(
    r'(\\\[(.*?)\\\]|\\\((.*?)\\\)|\$\$(.*?)\$\$|\$(.+?)\$)',
    dotAll: true,
  );

  @override
  Widget build(BuildContext context) {
    final textStyle = style ?? DefaultTextStyle.of(context).style;
    final children = <Widget>[];
    final inlineSpans = <InlineSpan>[];
    var cursor = 0;

    void flushInline() {
      if (inlineSpans.isEmpty) return;
      children.add(
        Text.rich(TextSpan(style: textStyle, children: List.of(inlineSpans))),
      );
      inlineSpans.clear();
    }

    for (final match in _mathPattern.allMatches(text)) {
      if (match.start > cursor) {
        inlineSpans.add(TextSpan(text: text.substring(cursor, match.start)));
      }
      final raw = match.group(0)!;
      final isBlock = raw.startsWith(r'\[') || raw.startsWith(r'$$');
      final expression =
          (match.group(2) ??
                  match.group(3) ??
                  match.group(4) ??
                  match.group(5) ??
                  '')
              .trim();
      final math = Math.tex(
        expression,
        mathStyle: isBlock ? MathStyle.display : MathStyle.text,
        textStyle: textStyle,
        onErrorFallback: (error) => Text(expression, style: textStyle),
      );

      if (isBlock) {
        flushInline();
        children.add(
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 8),
            child: Center(
              child: SingleChildScrollView(
                scrollDirection: Axis.horizontal,
                child: math,
              ),
            ),
          ),
        );
      } else {
        inlineSpans.add(
          WidgetSpan(alignment: PlaceholderAlignment.middle, child: math),
        );
      }
      cursor = match.end;
    }

    if (cursor < text.length) {
      inlineSpans.add(TextSpan(text: text.substring(cursor)));
    }
    flushInline();
    if (children.isEmpty) {
      return Text(text, style: textStyle);
    }
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: children,
    );
  }
}
