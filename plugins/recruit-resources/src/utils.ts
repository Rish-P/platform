import contact, { getName } from '@hcengineering/contact'
import core, {
  Hierarchy,
  type Class,
  type Client,
  type Doc,
  type DocData,
  type Ref,
  type Type,
  type TxOperations,
  type Obj,
  generateId
} from '@hcengineering/core'
import { getEmbeddedLabel, getMetadata, getResource } from '@hcengineering/platform'
import presentation, { getClient } from '@hcengineering/presentation'
import {
  recruitId,
  type Applicant,
  type Candidate,
  type Review,
  type Vacancy,
  type VacancyList,
  type ScriptAttribute
} from '@hcengineering/recruit'
import {
  type ScriptTypedAttributeEditorMixin,
  type ScriptTypedAttributeFactoryFn,
  type ScriptTypedAttributeFactoryMixin,
  type ScriptTypedPropertyEditorMixin
} from './types'

import { getCurrentResolvedLocation, getPanelURI, type Location, type ResolvedLocation } from '@hcengineering/ui'
import view from '@hcengineering/view'
import { workbenchId } from '@hcengineering/workbench'
import recruit from './plugin'

type RecruitDocument = Vacancy | Applicant | Review

export async function objectLinkProvider (doc: RecruitDocument): Promise<string> {
  const location = getCurrentResolvedLocation()
  const frontUrl = getMetadata(presentation.metadata.FrontUrl) ?? window.location.origin
  return `${frontUrl}/${workbenchId}/${location.path[1]}/${recruitId}/${await getSequenceId(doc)}`
}

function isShortId (shortLink: string): boolean {
  return /^\S+-\d+$/.test(shortLink)
}

export async function resolveLocation (loc: Location): Promise<ResolvedLocation | undefined> {
  if (loc.path[2] !== recruitId) {
    return undefined
  }

  const shortLink = loc.path[3]

  // shortlink
  if (isShortId(shortLink)) {
    return await generateLocation(loc, shortLink)
  } else if (shortLink !== undefined) {
    return await generateIdLocation(loc, shortLink)
  }
}

async function generateIdLocation (loc: Location, shortLink: string): Promise<ResolvedLocation | undefined> {
  const tokens = shortLink.split('-')
  if (tokens.length < 2) {
    return undefined
  }
  const client = getClient()
  const hierarchy = client.getHierarchy()

  const classLabel = tokens[0]
  const _id = tokens.slice(1).join('-')
  const classes = [recruit.mixin.VacancyList, recruit.mixin.Candidate]
  let _class: Ref<Class<Doc>> | undefined
  for (const clazz of classes) {
    if (hierarchy.getClass(clazz).shortLabel === classLabel) {
      _class = clazz
      break
    }
  }
  if (_class === undefined) {
    console.error(`Not found class with short label ${classLabel}`)
    return undefined
  }
  const doc = await client.findOne(_class, { _id: _id as Ref<Doc> })
  if (doc === undefined) {
    console.error(`Could not find ${_class} with id ${_id}.`)
    return undefined
  }
  const appComponent = loc.path[0] ?? ''
  const workspace = loc.path[1] ?? ''
  const objectPanel = hierarchy.classHierarchyMixin(Hierarchy.mixinOrClass(doc), view.mixin.ObjectPanel)

  const component = objectPanel?.component ?? view.component.EditDoc
  const special = _class === recruit.mixin.Candidate ? 'talents' : 'organizations'
  const defaultPath = [appComponent, workspace, recruitId, special]

  return {
    loc: {
      path: [appComponent, workspace],
      fragment: getPanelURI(component, doc._id, _class, 'content')
    },
    defaultLocation: {
      path: defaultPath,
      fragment: getPanelURI(component, doc._id, _class, 'content')
    }
  }
}

async function generateLocation (loc: Location, shortLink: string): Promise<ResolvedLocation | undefined> {
  const tokens = shortLink.split('-')
  if (tokens.length < 2) {
    return undefined
  }
  const classLabel = tokens[0]
  const number = Number(tokens[1])
  const client = getClient()
  const hierarchy = client.getHierarchy()
  const classes = [recruit.class.Applicant, recruit.class.Vacancy, recruit.class.Review]
  let _class: Ref<Class<Doc>> | undefined
  for (const clazz of classes) {
    if (hierarchy.getClass(clazz).shortLabel === classLabel) {
      _class = clazz
      break
    }
  }
  if (_class === undefined) {
    console.error(`Not found class with short label ${classLabel}`)
    return undefined
  }
  const doc = await client.findOne(_class, { number })
  if (doc === undefined) {
    console.error(`Could not find ${_class} with number ${number}.`)
    return undefined
  }
  const appComponent = loc.path[0] ?? ''
  const workspace = loc.path[1] ?? ''
  const objectPanel = hierarchy.classHierarchyMixin(_class, view.mixin.ObjectPanel)
  const component = objectPanel?.component ?? view.component.EditDoc
  const defaultPath = [appComponent, workspace, recruitId]
  if (_class === recruit.class.Vacancy) {
    defaultPath.push('vacancies')
  } else if (_class === recruit.class.Applicant) {
    defaultPath.push('candidates')
  }
  return {
    loc: {
      path: [appComponent, workspace],
      fragment: getPanelURI(component, doc._id, doc._class, 'content')
    },
    defaultLocation: {
      path: defaultPath,
      fragment: getPanelURI(component, doc._id, doc._class, 'content')
    }
  }
}

export async function getSequenceLink (doc: RecruitDocument): Promise<Location> {
  const loc = getCurrentResolvedLocation()
  loc.path.length = 2
  loc.fragment = undefined
  loc.query = undefined
  loc.path[2] = recruitId
  loc.path[3] = await getSequenceId(doc)

  return loc
}

export async function getObjectLink (doc: Candidate | VacancyList): Promise<Location> {
  const _class = Hierarchy.mixinOrClass(doc)
  const client = getClient()
  const clazz = client.getHierarchy().getClass(_class)
  const loc = getCurrentResolvedLocation()
  loc.path.length = 2
  loc.fragment = undefined
  loc.query = undefined
  loc.path[2] = recruitId
  loc.path[3] = clazz.shortLabel !== undefined ? `${clazz.shortLabel}-${doc._id}` : doc._id

  return loc
}

async function getTitle<T extends RecruitDocument> (
  client: Client,
  ref: Ref<T>,
  _class: Ref<Class<T>>
): Promise<string> {
  const object = await client.findOne<RecruitDocument>(_class, { _id: ref as Ref<any> })
  return object != null ? await getSequenceId(object) : ''
}

export async function getVacTitle (client: Client, ref: Ref<Vacancy>, doc?: Vacancy): Promise<string> {
  const object = doc ?? (await client.findOne(recruit.class.Vacancy, { _id: ref }))
  return object != null ? object.name : ''
}

export async function getAppTitle (client: Client, ref: Ref<Applicant>, doc?: Applicant): Promise<string> {
  const applicant = doc ?? (await client.findOne(recruit.class.Applicant, { _id: ref }))
  if (applicant === undefined) return ''
  const candidate = await client.findOne(contact.class.Contact, { _id: applicant.attachedTo })
  if (candidate === undefined) return ''
  return getName(client.getHierarchy(), candidate)
}

export async function getAppIdentifier (client: Client, ref: Ref<Applicant>, doc?: Applicant): Promise<string> {
  const applicant = doc ?? (await client.findOne(recruit.class.Applicant, { _id: ref }))

  if (applicant === undefined) {
    return ''
  }

  return applicant.identifier
}

export async function getRevTitle (client: Client, ref: Ref<Review>): Promise<string> {
  return await getTitle(client, ref, recruit.class.Review)
}

export async function getSequenceId (doc: RecruitDocument): Promise<string> {
  const client = getClient()
  const hierarchy = client.getHierarchy()
  if (hierarchy.isDerived(doc._class, recruit.class.Applicant)) {
    return (doc as Applicant).identifier
  }
  let clazz = hierarchy.getClass(doc._class)
  let label = clazz.shortLabel
  while (label === undefined && clazz.extends !== undefined) {
    clazz = hierarchy.getClass(clazz.extends)
    label = clazz.shortLabel
  }

  return label !== undefined ? `${label}-${doc.number}` : doc.number.toString()
}

export async function getTalentId (doc: Candidate): Promise<string> {
  return doc._id
}

export function getScriptAttributeTypeClasses (hierarchy: Hierarchy): Map<Ref<Class<Type<any>>>, Class<Type<any>>> {
  return new Map(
    hierarchy
      .getDescendants(core.class.Type)
      .map((descendantClassRef) => hierarchy.getClass(descendantClassRef))
      .filter((descendantClass) => hierarchy.hasMixin(descendantClass, recruit.mixin.ScriptTypedAttributeEditor))
      .map((descendantClass) => [descendantClass._id, descendantClass])
  )
}

export function getScriptTypedAttributeEditorMixin<T extends Type<any>> (
  hierarchy: Hierarchy,
  typeClassRef: Ref<Class<T>>
): ScriptTypedAttributeEditorMixin<T> | undefined {
  const _class = hierarchy.getClass(typeClassRef)
  return hierarchy.hasMixin(_class, recruit.mixin.ScriptTypedAttributeEditor)
    ? hierarchy.as(_class, recruit.mixin.ScriptTypedAttributeEditor)
    : undefined
}

export function getScriptTypedAttributeFactoryMixin<T extends Type<any>> (
  hierarchy: Hierarchy,
  typeClassRef: Ref<Class<T>>
): ScriptTypedAttributeFactoryMixin<T> | undefined {
  const _class = hierarchy.getClass(typeClassRef)
  return hierarchy.hasMixin(_class, recruit.mixin.ScriptTypedAttributeFactory)
    ? hierarchy.as(_class, recruit.mixin.ScriptTypedAttributeFactory)
    : undefined
}

export async function addScriptTypedAttribute<T extends Type<any>> (
  client: TxOperations,
  scriptClassRef: Ref<Class<Obj>>,
  typeClass: Class<T>,
  attributeData: Omit<DocData<ScriptAttribute<T>>, 'label' | 'attributeOf' | 'name' | 'type'>
): Promise<Ref<ScriptAttribute>> {
  let factoryValues = {}
  const factoryMixin = getScriptTypedAttributeFactoryMixin(client.getHierarchy(), typeClass._id)
  if (factoryMixin !== undefined) {
    const factoryFn = await getResource<ScriptTypedAttributeFactoryFn<T>>(factoryMixin.factory)
    factoryValues = await factoryFn()
  }

  const id = generateId()
  return await client.createDoc<ScriptAttribute>(
    core.class.Attribute,
    core.space.Model,
    {
      ...factoryValues,
      ...attributeData,
      label: getEmbeddedLabel(''),
      attributeOf: scriptClassRef,
      name: id,
      // TODO: There should be a better way to instantiate registered class (even a type class)
      type: {
        _class: typeClass._id,
        label: typeClass.label,
        hidden: false,
        readonly: false
      }
    },
    id as Ref<ScriptAttribute>
  )
}

export function getScriptTypedPropertyEditorMixin<T extends Type<any>> (
  hierarchy: Hierarchy,
  type: Ref<Class<T>>
): ScriptTypedPropertyEditorMixin<T> | undefined {
  const _class = hierarchy.getClass(type)
  return hierarchy.hasMixin(_class, recruit.mixin.ScriptTypedPropertyEditor)
    ? hierarchy.as(_class, recruit.mixin.ScriptTypedPropertyEditor)
    : undefined
}

export function makeScriptClassRef (vacancyRef: Ref<Vacancy>): Ref<Class<Obj>> {
  return `${recruitId}:class:script:${vacancyRef}` as Ref<Class<Obj>>
}
