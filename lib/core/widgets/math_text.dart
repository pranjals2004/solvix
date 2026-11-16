import 'package:flutter/material.dart';

class MathText extends StatelessWidget {
  final String text;
  final TextStyle? style;

  const MathText(this.text, {Key? key, this.style}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final baseStyle = style ?? theme.textTheme.bodyMedium;

    // A simple parser that identifies LaTeX boundaries like:
    // \[ ... \] or $$ ... $$ for block math
    // \( ... \) or $ ... $ for inline math
    // It renders them with a distinctive academic/monospace style (Courier/Times/Italicized).
    
    final blocks = _parseText(text);
    
    return RichText(
      text: TextSpan(
        children: blocks.map((block) {
          if (block.isMath) {
            return TextSpan(
              text: block.text,
              style: baseStyle?.copyWith(
                fontFamily: 'serif',
                fontStyle: FontStyle.italic,
                fontWeight: FontWeight.w600,
                color: theme.colorScheme.secondary,
              ),
            );
          } else {
            return TextSpan(
              text: block.text,
              style: baseStyle,
            );
          }
        }).toList(),
      ),
    );
  }

  List<TextSegment> _parseText(String rawText) {
    final List<TextSegment> segments = [];
    int index = 0;
    
    // Regular expression matching math blocks: \[...\] or \(...\) or $$...$$ or $...$
    final regExp = RegExp(r'(\\\[.*?\\\]|\\\(.*?\\\)|$$\$.*?\$\$\$|\$.*?\$)');
    final matches = regExp.allMatches(rawText);

    for (final match in matches) {
      // Plain text before the match
      if (match.start > index) {
        segments.add(TextSegment(
          text: rawText.substring(index, match.start),
          isMath: false,
        ));
      }

      // The math block itself
      String mathContent = match.group(0)!;
      // Strip delimiters for cleaner UI
      if (mathContent.startsWith('\\[')) {
        mathContent = mathContent.substring(2, mathContent.length - 2).trim();
      } else if (mathContent.startsWith('\\(')) {
        mathContent = mathContent.substring(2, mathContent.length - 2).trim();
      } else if (mathContent.startsWith(r'$$')) {
        mathContent = mathContent.substring(2, mathContent.length - 2).trim();
      } else if (mathContent.startsWith(r'$')) {
        mathContent = mathContent.substring(1, mathContent.length - 1).trim();
      }

      // Basic character replacements for visual LaTeX (e.g. \Theta -> θ, \approx -> ≈, \le -> ≤)
      mathContent = mathContent
          .replaceAll(r'\Theta', 'θ')
          .replaceAll(r'\theta', 'θ')
          .replaceAll(r'\approx', '≈')
          .replaceAll(r'\le', '≤')
          .replaceAll(r'\ge', '≥')
          .replaceAll(r'\times', '×')
          .replaceAll(r'\le', '≤')
          .replaceAll(r'\ge', '≥')
          .replaceAll(r'\log', 'log')
          .replaceAll(r'\text', '')
          .replaceAll(r'\le', '≤')
          .replaceAll(r'\ge', '≥')
          .replaceAll(r'\le', '≤')
          .replaceAll(r'\frac', '')
          .replaceAll(r'\mid', '|');

      segments.add(TextSegment(
        text: ' $mathContent ',
        isMath: true,
      ));
      
      index = match.end;
    }

    if (index < rawText.length) {
      segments.add(TextSegment(
        text: rawText.substring(index),
        isMath: false,
      ));
    }

    return segments.isEmpty ? [TextSegment(text: rawText, isMath: false)] : segments;
  }
}

class TextSegment {
  final String text;
  final bool isMath;

  TextSegment({required this.text, required this.isMath});
}
