// Trie (albero dei prefissi) per validazione rapida di parole e prefissi.
// Usato sia per generare la griglia (piazzare parole) sia per lo scan
// finale che scova parole "bonus" formate per caso.

class TrieNode {
  constructor() {
    this.children = new Map();
    this.isWord = false;
  }
}

export default class Trie {
  constructor() {
    this.root = new TrieNode();
  }

  insert(word) {
    let node = this.root;
    for (const ch of word) {
      if (!node.children.has(ch)) node.children.set(ch, new TrieNode());
      node = node.children.get(ch);
    }
    node.isWord = true;
  }

  _nodeAt(prefix) {
    let node = this.root;
    for (const ch of prefix) {
      const next = node.children.get(ch);
      if (!next) return null;
      node = next;
    }
    return node;
  }

  hasPrefix(prefix) {
    return this._nodeAt(prefix) !== null;
  }

  isWord(word) {
    const node = this._nodeAt(word);
    return !!node && node.isWord;
  }
}
