#!/usr/bin/env python3
"""
Process full SBLGNT corpus → isopsefia + NPR routes.

Output:
  derived/sblgnt_corpus.json — full verse-by-verse analysis
  derived/verse_values.json — verse totals per book
  derived/npr_routes.json — NPR cycle assignments
"""
import json
import os
import re
import sys
sys.path.insert(0, os.path.dirname(__file__))

from isopsefia import normalize_greek, word_value, digital_root

def parse_verse_line(line):
    """Parse a verse line like 'Mt 1:1\tGreek text...' or '61-Mt 1:1 Greek text...'"""
    # Try standard format first: "Mt 1:1\ttext..."
    m = re.match(r'^(\w+)\s+(\d+):(\d+)\s+(.+)$', line.strip())
    if not m:
        # Try book-prefixed format: "61-Mt 1:1 text..."
        m = re.match(r'^(\d{2}-\w+)\s+(\d+):(\d+)\s+(.+)$', line.strip())
    if not m:
        return None
    
    book, chapter, verse, text = m.groups()
    return {
        'book': book,
        'chapter': int(chapter),
        'verse': int(verse),
        'text': text.strip(),
    }

def process_book(filepath):
    """Process a single book file."""
    book_name = os.path.basename(filepath)
    verses = []
    
    with open(filepath, encoding='utf-8') as f:
        for line in f:
            parsed = parse_verse_line(line)
            if parsed:
                # Calculate word values
                words = parsed['text'].split()
                word_data = []
                total = 0
                
                for word in words:
                    clean = normalize_greek(word)
                    val = word_value(clean)
                    if val > 0:
                        word_data.append({
                            'word': word,
                            'clean': clean,
                            'value': val,
                            'dr': digital_root(val),
                        })
                        total += val
                
                verses.append({
                    **parsed,
                    'words': word_data,
                    'total': total,
                    'hex': hex(total),
                    'dr': digital_root(total),
                    # NPR cycle assignment
                    'npr_cycle': ((total - 1) % 3) + 1,  # 1, 2, or 3
                })
    
    return {
        'book': book_name,
        'verse_count': len(verses),
        'verses': verses,
    }

def process_corpus(text_dir, output_dir):
    """Process all books in corpus."""
    all_books = []
    all_verses = []
    
    # Get all book files
    files = sorted([f for f in os.listdir(text_dir) 
                   if f.endswith('.txt') and f[0].isdigit()])
    
    for fname in files:
        filepath = os.path.join(text_dir, fname)
        print(f"Processing {fname}...")
        book_data = process_book(filepath)
        all_books.append(book_data)
        all_verses.extend(book_data['verses'])
    
    # Write outputs
    os.makedirs(output_dir, exist_ok=True)
    
    # Full corpus
    corpus = {
        'books': all_books,
        'total_verses': len(all_verses),
    }
    with open(os.path.join(output_dir, 'sblgnt_corpus.json'), 'w', encoding='utf-8') as f:
        json.dump(corpus, f, ensure_ascii=False, indent=2)
    
    # Verse values summary
    verse_summary = []
    for v in all_verses:
        verse_summary.append({
            'ref': f"{v['book']} {v['chapter']}:{v['verse']}",
            'total': v['total'],
            'dr': v['dr'],
            'cycle': v['npr_cycle'],
        })
    with open(os.path.join(output_dir, 'verse_values.json'), 'w', encoding='utf-8') as f:
        json.dump(verse_summary, f, ensure_ascii=False, indent=2)
    
    # NPR routes
    npr_data = {
        'verses': verse_summary,
        'cycle_distribution': {
            'cycle_1': sum(1 for v in verse_summary if v['cycle'] == 1),
            'cycle_2': sum(1 for v in verse_summary if v['cycle'] == 2),
            'cycle_3': sum(1 for v in verse_summary if v['cycle'] == 3),
        },
    }
    with open(os.path.join(output_dir, 'npr_routes.json'), 'w', encoding='utf-8') as f:
        json.dump(npr_data, f, ensure_ascii=False, indent=2)
    
    return corpus, verse_summary, npr_data

# Run
if __name__ == '__main__':
    text_dir = os.path.join(os.path.dirname(__file__), '..', 'text')
    output_dir = os.path.join(os.path.dirname(__file__), '..', 'derived')
    
    print("Processing SBLGNT corpus...")
    corpus, verses, npr = process_corpus(text_dir, output_dir)
    
    print(f"\nResults:")
    print(f"  Books: {len(corpus['books'])}")
    print(f"  Total verses: {corpus['total_verses']}")
    print(f"  NPR cycles: {npr['cycle_distribution']}")
    
    # Print first few verses
    print("\nSample verses:")
    for v in verses[:5]:
        print(f"  {v['ref']}: total={v['total']}, DR={v['dr']}, cycle={v['cycle']}")
