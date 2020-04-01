import { parse, DefaultTreeDocument, DefaultTreeTextNode, DefaultTreeElement, DefaultTreeNode, Attribute } from "parse5"
import { TAGS_MAP } from "./constants"

interface TreeNode extends DefaultTreeElement {
  attrsMap: Map<string, Attribute>,
  isIf: boolean,
  isElseIf: boolean,
  isElse: boolean,
  nextElseTemplateId: number,
  templateId: number,
}

interface IContext {
  lines: string[],
  ngTemplateCounter: number,
}

export const replaceAttrList: Set<string> = new Set([
  "wx:for-item", "wx:for-index"
])

export const convertWxmlToVueTemplate = (wxmlString: string): string => {
  const ast = parse(wxmlString) as any
  const ctx = { lines: [], ngTemplateCounter: 0 }
  const htmlNode = getHtmlNode(ast)
  const fragment: TreeNode[] = preprocessNodes(htmlNode.childNodes[1].childNodes, ctx)
  wxmlFragment2Vue(fragment, ctx)
  return ctx.lines.join("")
}

const getHtmlNode = (ast) => {
  for (const node of ast.childNodes) {
    if (node.nodeName === "html") {
      return node
    }
  }
}

const preprocessNodes = (tree: TreeNode[], ctx: IContext): TreeNode[] => {
  let prev: null | TreeNode
  for (const node of tree) {
    node.attrsMap = new Map()
    if (node.attrs) {
      for (const attr of node.attrs) {
        node.attrsMap.set(attr.name, attr)
      }
      if (node.attrsMap.get("wx:if")) {
        node.isIf = true
      } else if (node.attrsMap.get("wx:elif")){
        node.isElseIf = true
      } else if (node.attrsMap.get("wx:else")) {
        node.isElse = true
      }
    }
    if (node.childNodes) {
      preprocessNodes(node.childNodes as TreeNode[], ctx)
    }
    if ((node.isElse || node.isElseIf) && prev) {
      node.templateId = ++ctx.ngTemplateCounter
      prev.nextElseTemplateId = node.templateId
    }
    if (isNormalNode(node)) {
      prev = node
    }
  }
  return tree
}

export const wxmlFragment2Vue = (fragment: TreeNode[], ctx: IContext) => {
  for (const node of fragment) {
    if (!node.nodeName.startsWith("#")) {
      ctx.lines.push(parseWxmlNodeToVueStartTag(node))
      wxmlFragment2Vue(node.childNodes as any, ctx)
      ctx.lines.push(getParsedWxmlEndTagName(node))
    } else {
      if (node.nodeName === "#text") {
        ctx.lines.push((node as any).value)
      } else {
        ctx.lines.push(`<!--${(node as any).data}-->`)
      }
    }
  }
}

const parseWxmlNodeToVueStartTag = (node: TreeNode): string => {
  const tagName = getTagNameByWxmlNode(node)
  const attrsStr = parseWxmlNodeToAttrsString(node)
  const typeAttrStr = getTypeAttrStr(node.nodeName, tagName)
  // console.log(tagName, TAGS_MAP)
  return `<${tagName} ${typeAttrStr} ${attrsStr}>`
}

const getTypeAttrStr = (originalNodeName, tagName) => {
  if (originalNodeName === "checkbox") {
    return `type="checkbox"`
  }
  return ""
}

const getIfElseAttr = (node: TreeNode): string => {
  return getNgIfElseAttrValue(node.attrsMap.get("wx:elif"), node)
}

const getParsedWxmlEndTagName = (node: TreeNode): string => {
  return `</${getTagNameByWxmlNode(node)}>`
}

const getTagNameByWxmlNode = (node: TreeNode) => {
  return TAGS_MAP[node.nodeName] || node.nodeName
}

const parseWxmlNodeToAttrsString = (node: TreeNode): string => {
  const attrsList = []
  for (const attr of node.attrs) {
    attrsList.push(parseWxmlAttrToVueAttrStr(attr, node))
  }
  return attrsList.join(" ")
}

const parseWxmlAttrToVueAttrStr = (attr: Attribute, node: TreeNode): string => {
  const n = attr.name
  const v = stripDelimiters(attr.value)
  if (n === "wx:for") {
    const test = parseWxmlWxFor(attr, node)
    console.log(test)
    return test
  } else if (n === "wx:if") {
    return `v-if="${stripDelimiters(attr.value)}"`
  } else if (n === "wx:elif") {
    return `v-else-if="${stripDelimiters(attr.value)}"`
  } else if (n === "wx:else") {
    return `v-else`
  } else if (n === "bindtap") {
    return `v-touch:tap="${v}"`
  } else if (n === "bindinput") {
    return `v-on:input="${v}"`
  } else if (n === "value") {
    return `v-model="${v}"`
  } else if (n === "bindchange") {
    return `v-on:change="${v}"`
  } else if (replaceAttrList.has(n)) {
    return ""
  }
  return attr.value ? `${attr.name}="${attr.value}"` : attr.name
}

const parseWxmlWxFor = (attr: Attribute, node: TreeNode) :string => {
  const attrsMap = node.attrsMap
  const itemKeyAttr = attrsMap.get("wx:for-item")
  const indexKeyAttr = attrsMap.get("wx:for-index")
  console.log(itemKeyAttr, indexKeyAttr)
  return `v-for="(${itemKeyAttr ? itemKeyAttr.value : "item"}, ${indexKeyAttr ? indexKeyAttr.value : "index"}) in ${stripDelimiters(attr.value)}"`
}

const getNgIfElseAttrValue = (attr: Attribute, node: TreeNode): string => {
  return `${stripDelimiters(attr.value)}${node.nextElseTemplateId ? `; else elseBlock${node.nextElseTemplateId}` : ''}`
}

const stripDelimiters = (val: string): string => {
  return val.replace(/(^\{\{)|(\}\}$)/g, '')
}

const isNormalNode = (node: TreeNode): boolean => {
  return !node.nodeName.startsWith("#")
}

const isElseOrIfElseNode = (node: TreeNode): boolean => {
  return node.isElse || node.isElseIf
}

// console.log(convertWxmlToNgTemplate(html))
