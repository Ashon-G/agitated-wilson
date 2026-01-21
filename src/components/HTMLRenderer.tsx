import React from 'react';
import { View, Text, Image, Pressable, Linking, StyleSheet, useWindowDimensions } from 'react-native';

interface HTMLRendererProps {
  html: string;
  isDark: boolean;
  featuredImageUrl?: string; // Skip rendering this image as it's already shown as hero
}

/**
 * HTML renderer that converts HTML to native React Native components
 * Uses a recursive approach to properly handle nested tags
 */
export function HTMLRenderer({ html, isDark, featuredImageUrl }: HTMLRendererProps) {
  const { width } = useWindowDimensions();
  const contentWidth = width - 40; // Account for padding

  const textColor = isDark ? '#E5E7EB' : '#374151';
  const headingColor = isDark ? '#F9FAFB' : '#111827';
  const linkColor = '#3B82F6';
  const codeBackground = isDark ? '#1F2937' : '#F3F4F6';
  const blockquoteBorder = isDark ? '#4B5563' : '#D1D5DB';
  const blockquoteBackground = isDark ? '#1F2937' : '#F9FAFB';

  // Decode HTML entities
  const decodeEntities = (str: string): string => {
    return str
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&rsquo;/g, "'")
      .replace(/&lsquo;/g, "'")
      .replace(/&rdquo;/g, '"')
      .replace(/&ldquo;/g, '"')
      .replace(/&mdash;/g, '—')
      .replace(/&ndash;/g, '–')
      .replace(/&hellip;/g, '…')
      .replace(/&#(\d+);/g, (_, num) => String.fromCharCode(parseInt(num, 10)));
  };

  // Strip all HTML tags and get plain text
  const stripTags = (str: string): string => {
    return decodeEntities(str.replace(/<[^>]*>/g, ''));
  };

  // Parse attributes from tag string
  const parseAttributes = (attrStr: string): Record<string, string> => {
    const attrs: Record<string, string> = {};
    const attrPattern = /([\w-]+)=["']([^"']*)["']/g;
    let match;
    while ((match = attrPattern.exec(attrStr)) !== null) {
      attrs[match[1]] = match[2];
    }
    return attrs;
  };

  // Check if an image URL matches the featured image (should be skipped)
  const isFeaturedImage = (imgUrl: string): boolean => {
    if (!featuredImageUrl || !imgUrl) return false;
    // Compare URLs - handle both exact matches and partial matches (e.g., different query params)
    const normalize = (url: string) => url.split('?')[0].replace(/^https?:\/\//, '');
    return normalize(imgUrl) === normalize(featuredImageUrl);
  };

  // Extract image from content if exists
  const extractImages = (content: string): { images: Array<{ src: string; alt?: string }>; cleanContent: string } => {
    const images: Array<{ src: string; alt?: string }> = [];
    const imgPattern = /<img[^>]*src=["']([^"']*)["'][^>]*(?:alt=["']([^"']*)["'])?[^>]*\/?>/gi;

    let cleanContent = content;
    let match;

    while ((match = imgPattern.exec(content)) !== null) {
      images.push({ src: match[1], alt: match[2] });
    }

    cleanContent = content.replace(imgPattern, '');

    return { images, cleanContent };
  };

  // Render a block of content (can contain nested inline elements)
  const renderTextWithInline = (content: string, baseStyle: any, key: string): React.ReactNode => {
    // Handle inline elements: strong, em, a, code
    const parts: React.ReactNode[] = [];
    const remaining = content;
    let partIndex = 0;

    // Process inline tags
    const inlinePattern = /<(strong|b|em|i|a|code)([^>]*)>([\s\S]*?)<\/\1>/gi;
    let lastIndex = 0;
    let match;

    while ((match = inlinePattern.exec(content)) !== null) {
      // Add text before this match
      const textBefore = remaining.substring(lastIndex, match.index);
      if (textBefore) {
        parts.push(
          <Text key={`${key}-text-${partIndex++}`} style={baseStyle}>
            {decodeEntities(textBefore)}
          </Text>,
        );
      }

      const [, tagName, attrs, innerContent] = match;
      const tag = tagName.toLowerCase();
      const attributes = parseAttributes(attrs);

      switch (tag) {
        case 'strong':
        case 'b':
          parts.push(
            <Text key={`${key}-bold-${partIndex++}`} style={[baseStyle, { fontWeight: '700' }]}>
              {decodeEntities(stripTags(innerContent))}
            </Text>,
          );
          break;
        case 'em':
        case 'i':
          parts.push(
            <Text key={`${key}-italic-${partIndex++}`} style={[baseStyle, { fontStyle: 'italic' }]}>
              {decodeEntities(stripTags(innerContent))}
            </Text>,
          );
          break;
        case 'a':
          parts.push(
            <Text
              key={`${key}-link-${partIndex++}`}
              style={[baseStyle, { color: linkColor, textDecorationLine: 'underline' }]}
              onPress={() => attributes.href && Linking.openURL(attributes.href)}
            >
              {decodeEntities(stripTags(innerContent))}
            </Text>,
          );
          break;
        case 'code':
          parts.push(
            <Text
              key={`${key}-code-${partIndex++}`}
              style={[baseStyle, { fontFamily: 'monospace', backgroundColor: codeBackground, paddingHorizontal: 4 }]}
            >
              {decodeEntities(stripTags(innerContent))}
            </Text>,
          );
          break;
      }

      lastIndex = match.index + match[0].length;
    }

    // Add remaining text
    const remainingText = content.substring(lastIndex);
    if (remainingText) {
      parts.push(
        <Text key={`${key}-text-${partIndex++}`} style={baseStyle}>
          {decodeEntities(stripTags(remainingText))}
        </Text>,
      );
    }

    if (parts.length === 0) {
      return (
        <Text key={key} style={baseStyle}>
          {decodeEntities(stripTags(content))}
        </Text>
      );
    }

    return (
      <Text key={key} style={baseStyle}>
        {parts}
      </Text>
    );
  };

  // Parse and render the HTML
  const renderHTML = (htmlContent: string): React.ReactNode[] => {
    const elements: React.ReactNode[] = [];
    let elementIndex = 0;

    // Split by block-level tags
    const blockPattern = /<(p|h[1-6]|div|blockquote|ul|ol|li|pre|hr|br|figure|figcaption)([^>]*)>([\s\S]*?)<\/\1>|<(img|hr|br)[^>]*\/?>/gi;

    let lastIndex = 0;
    let match;

    while ((match = blockPattern.exec(htmlContent)) !== null) {
      // Check for text between blocks
      const textBetween = htmlContent.substring(lastIndex, match.index).trim();
      if (textBetween && stripTags(textBetween).trim()) {
        elements.push(
          <Text key={`text-${elementIndex++}`} style={[styles.paragraph, { color: textColor }]}>
            {decodeEntities(stripTags(textBetween))}
          </Text>,
        );
      }

      const fullMatch = match[0];
      const tagName = (match[1] || match[4] || '').toLowerCase();
      const content = match[3] || '';

      switch (tagName) {
        case 'p':
          const { images, cleanContent } = extractImages(content);
          const textContent = stripTags(cleanContent).trim();

          // Render images first (skip featured image)
          images.forEach((img) => {
            if (isFeaturedImage(img.src)) return; // Skip featured image
            elements.push(
              <View key={`img-${elementIndex++}`} style={styles.imageContainer}>
                <Image
                  source={{ uri: img.src }}
                  style={[styles.image, { width: contentWidth }]}
                  resizeMode="cover"
                />
                {img.alt && (
                  <Text style={[styles.imageCaption, { color: textColor }]}>
                    {img.alt}
                  </Text>
                )}
              </View>,
            );
          });

          // Render text content if any
          if (textContent) {
            elements.push(
              renderTextWithInline(cleanContent, [styles.paragraph, { color: textColor }], `p-${elementIndex++}`),
            );
          }
          break;

        case 'h1':
          elements.push(
            renderTextWithInline(content, [styles.h1, { color: headingColor }], `h1-${elementIndex++}`),
          );
          break;

        case 'h2':
          elements.push(
            renderTextWithInline(content, [styles.h2, { color: headingColor }], `h2-${elementIndex++}`),
          );
          break;

        case 'h3':
          elements.push(
            renderTextWithInline(content, [styles.h3, { color: headingColor }], `h3-${elementIndex++}`),
          );
          break;

        case 'h4':
        case 'h5':
        case 'h6':
          elements.push(
            renderTextWithInline(content, [styles.h4, { color: headingColor }], `h4-${elementIndex++}`),
          );
          break;

        case 'blockquote':
          elements.push(
            <View
              key={`blockquote-${elementIndex++}`}
              style={[styles.blockquote, { borderLeftColor: blockquoteBorder, backgroundColor: blockquoteBackground }]}
            >
              <Text style={[styles.blockquoteText, { color: textColor }]}>
                {decodeEntities(stripTags(content))}
              </Text>
            </View>,
          );
          break;

        case 'ul':
        case 'ol':
          // Extract list items
          const liPattern = /<li[^>]*>([\s\S]*?)<\/li>/gi;
          let liMatch;
          let liIndex = 0;
          const listItems: React.ReactNode[] = [];

          while ((liMatch = liPattern.exec(content)) !== null) {
            const liContent = stripTags(liMatch[1]).trim();
            if (liContent) {
              listItems.push(
                <View key={`li-${liIndex}`} style={styles.listItem}>
                  <Text style={[styles.listBullet, { color: textColor }]}>
                    {tagName === 'ol' ? `${liIndex + 1}.` : '•'}
                  </Text>
                  <Text style={[styles.listItemText, { color: textColor }]}>
                    {liContent}
                  </Text>
                </View>,
              );
              liIndex++;
            }
          }

          if (listItems.length > 0) {
            elements.push(
              <View key={`list-${elementIndex++}`} style={styles.list}>
                {listItems}
              </View>,
            );
          }
          break;

        case 'li':
          // Individual li outside of ul/ol
          const liText = stripTags(content).trim();
          if (liText) {
            elements.push(
              <View key={`li-${elementIndex++}`} style={styles.listItem}>
                <Text style={[styles.listBullet, { color: textColor }]}>•</Text>
                <Text style={[styles.listItemText, { color: textColor }]}>{liText}</Text>
              </View>,
            );
          }
          break;

        case 'pre':
          elements.push(
            <View key={`pre-${elementIndex++}`} style={[styles.preBlock, { backgroundColor: codeBackground }]}>
              <Text style={[styles.codeText, { color: textColor }]}>
                {decodeEntities(stripTags(content))}
              </Text>
            </View>,
          );
          break;

        case 'figure':
          // Handle figure with image
          const figImgMatch = /<img[^>]*src=["']([^"']*)["'][^>]*>/i.exec(content);
          const figCapMatch = /<figcaption[^>]*>([\s\S]*?)<\/figcaption>/i.exec(content);

          if (figImgMatch && !isFeaturedImage(figImgMatch[1])) {
            elements.push(
              <View key={`figure-${elementIndex++}`} style={styles.imageContainer}>
                <Image
                  source={{ uri: figImgMatch[1] }}
                  style={[styles.image, { width: contentWidth }]}
                  resizeMode="cover"
                />
                {figCapMatch && (
                  <Text style={[styles.imageCaption, { color: textColor }]}>
                    {stripTags(figCapMatch[1])}
                  </Text>
                )}
              </View>,
            );
          }
          break;

        case 'img':
          const srcMatch = /src=["']([^"']*)["']/i.exec(fullMatch);
          const altMatch = /alt=["']([^"']*)["']/i.exec(fullMatch);

          if (srcMatch && !isFeaturedImage(srcMatch[1])) {
            elements.push(
              <View key={`img-${elementIndex++}`} style={styles.imageContainer}>
                <Image
                  source={{ uri: srcMatch[1] }}
                  style={[styles.image, { width: contentWidth }]}
                  resizeMode="cover"
                />
                {altMatch && (
                  <Text style={[styles.imageCaption, { color: textColor }]}>
                    {altMatch[1]}
                  </Text>
                )}
              </View>,
            );
          }
          break;

        case 'hr':
          elements.push(
            <View
              key={`hr-${elementIndex++}`}
              style={[styles.horizontalRule, { backgroundColor: isDark ? '#374151' : '#E5E7EB' }]}
            />,
          );
          break;

        case 'br':
          elements.push(<View key={`br-${elementIndex++}`} style={styles.lineBreak} />);
          break;

        case 'div':
          // Recursively render div content
          const divContent = stripTags(content).trim();
          if (divContent) {
            elements.push(
              <Text key={`div-${elementIndex++}`} style={[styles.paragraph, { color: textColor }]}>
                {divContent}
              </Text>,
            );
          }
          break;
      }

      lastIndex = match.index + fullMatch.length;
    }

    // Handle remaining content after last match
    const remainingContent = htmlContent.substring(lastIndex).trim();
    if (remainingContent && stripTags(remainingContent).trim()) {
      elements.push(
        <Text key={`remaining-${elementIndex++}`} style={[styles.paragraph, { color: textColor }]}>
          {decodeEntities(stripTags(remainingContent))}
        </Text>,
      );
    }

    return elements;
  };

  if (!html) {
    return null;
  }

  const elements = renderHTML(html);

  return (
    <View style={styles.container}>
      {elements}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 16,
  },
  paragraph: {
    fontSize: 17,
    lineHeight: 28,
  },
  h1: {
    fontSize: 28,
    fontWeight: '700',
    lineHeight: 36,
    marginTop: 24,
    marginBottom: 8,
  },
  h2: {
    fontSize: 24,
    fontWeight: '700',
    lineHeight: 32,
    marginTop: 20,
    marginBottom: 8,
  },
  h3: {
    fontSize: 20,
    fontWeight: '600',
    lineHeight: 28,
    marginTop: 16,
    marginBottom: 4,
  },
  h4: {
    fontSize: 18,
    fontWeight: '600',
    lineHeight: 26,
    marginTop: 12,
    marginBottom: 4,
  },
  bold: {
    fontSize: 17,
    fontWeight: '700',
    lineHeight: 28,
  },
  italic: {
    fontSize: 17,
    fontStyle: 'italic',
    lineHeight: 28,
  },
  link: {
    fontSize: 17,
    lineHeight: 28,
    textDecorationLine: 'underline',
  },
  imageContainer: {
    marginVertical: 16,
    borderRadius: 12,
    overflow: 'hidden',
  },
  image: {
    height: 200,
    borderRadius: 12,
  },
  imageCaption: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
    opacity: 0.7,
  },
  blockquote: {
    borderLeftWidth: 4,
    paddingLeft: 16,
    paddingVertical: 12,
    paddingRight: 12,
    marginVertical: 8,
    borderRadius: 4,
  },
  blockquoteText: {
    fontSize: 16,
    fontStyle: 'italic',
    lineHeight: 26,
  },
  codeBlock: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    marginVertical: 4,
  },
  preBlock: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    marginVertical: 8,
  },
  codeText: {
    fontFamily: 'monospace',
    fontSize: 14,
    lineHeight: 22,
  },
  list: {
    marginVertical: 8,
  },
  listItem: {
    flexDirection: 'row',
    marginBottom: 8,
    paddingRight: 16,
  },
  listBullet: {
    fontSize: 17,
    lineHeight: 28,
    width: 24,
  },
  listItemText: {
    flex: 1,
    fontSize: 17,
    lineHeight: 28,
  },
  lineBreak: {
    height: 8,
  },
  horizontalRule: {
    height: 1,
    marginVertical: 24,
  },
});

export default HTMLRenderer;
