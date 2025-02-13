/**
 * BEGIN HEADER
 *
 * Contains:        Vuex store entry point
 * CVM-Role:        Controller
 * Maintainer:      Hendrik Erz
 * License:         GNU GPL v3
 *
 * Description:     This file holds the configuration for the global Vuex store.
 *                  We only have a Vuex store in the main application window
 *                  as this one needs to actually handle a huge state – something
 *                  not applicable to the other windows.
 *
 * END HEADER
 */

import { StoreOptions, createStore as baseCreateStore, Store } from 'vuex'
import { InjectionKey } from 'vue'
import { CodeFileMeta, DirMeta, MDFileMeta, OtherFileMeta } from '@dts/common/fsal'
import { ColouredTag, TagDatabase } from '@dts/common/tag-provider'
import { SearchResultWrapper } from '@dts/common/search'
import { RelatedFile } from '@dts/renderer/misc'
import locateByPath from '@providers/fsal/util/locate-by-path'
import configToArrayMapper from './config-to-array'
import { BranchNodeJSON, LeafNodeJSON, OpenDocument } from '@dts/common/documents'

// Import Mutations
import addToFiletreeMutation from './mutations/add-to-filetree'
import removeFromFiletreeMutation from './mutations/remove-from-filetree'
import patchInFiletreeMutation from './mutations/patch-in-filetree'
import updateOpenDirectoryMutation from './mutations/update-open-directory'
import documentTreeMutation from './mutations/document-tree'

// Import Actions
import filetreeUpdateAction from './actions/filetree-update'
import regenerateTagSuggestionsAction from './actions/regenerate-tag-suggestions'
import updateOpenDirectoryAction from './actions/update-open-directory'
import updateRelatedFilesAction from './actions/update-related-files'
import updateBibliographyAction from './actions/update-bibliography'
import documentTreeUpdateAction from './actions/document-tree-update'

/**
 * The injection key is required for store access from within composition API
 * components
 */
export const key: InjectionKey<Store<ZettlrState>> = Symbol('store key')

/**
 * This is the main window's store state, including all properties we have
 */
export interface ZettlrState {
  /**
   * Contains the full file tree that is loaded into the app
   */
  fileTree: Array<MDFileMeta|CodeFileMeta|DirMeta>
  /**
   * Contains the last update timestamp from main
   */
  lastFiletreeUpdate: number
  /**
   * Contains a full document tree managed by this window
   */
  paneStructure: BranchNodeJSON|LeafNodeJSON
  /**
   * Contains just the data points of the document tree
   */
  paneData: LeafNodeJSON[]
  /**
   * Holds the currently modified files alongside their last modification timestamp
   */
  modifiedFiles: Map<string, number>
  /**
   * This array contains the paths of directories which are open (necessary to
   * keep the state during filtering, etc.)
   */
  uncollapsedDirectories: string[]
  /**
   * Contains the currently selected directory
   */
  selectedDirectory: DirMeta|null
  activeFile: null
  /**
   * This property contains all leaf IDs on which the readability mode is
   * currently active
   */
  readabilityModeActive: string[]
  /**
   * Files which are in some way related to the currently active file
   */
  relatedFiles: RelatedFile[]
  /**
   * Contains coloured tags that can be managed in the tag manager
   */
  colouredTags: ColouredTag[]
  /**
   * Contains all tags across all files loaded into Zettlr
   */
  tagDatabase: TagDatabase[]
  /**
   * Contains a list of suggested tags for the current active file.
   */
  tagSuggestions: string[]
  /**
   * Holds all configuration options. These need to be stored here separately
   * to make use of the reactivity of Vue. We'll basically be binding the config
   * listener to this store state. It's basically a dictionary for quick access.
   */
  config: any
  /**
   * Info about the currently active document
   */
  activeDocumentInfo: DocumentInfo|null
  /**
   * Modified files are stored here (only the paths, though)
   */
  modifiedDocuments: string[]
  /**
   * Contains the current table of contents of the active document
   */
  tableOfContents: any|null
  /**
   * Citation keys to be found within the current document
   */
  citationKeys: string[]
  /**
   * The currently rendered bibliography (if applicable)
   */
  bibliography: [BibliographyOptions, string[]]|undefined
  /**
   * All CSL items available in the currently loaded database
   */
  cslItems: any[]
  /**
   * This variable stores search results from the global search
   */
  searchResults: SearchResultWrapper[]
  /**
   * This describes the editor that was most recently focused. Can be used to,
   * e.g., retrieve that state's activeFile.
   */
  lastLeafId: string|undefined
  /**
   * If any leaf is currently in distractionFree, this variable will hold its
   * leafId. Otherwise, it's undefined.
   */
  distractionFreeMode: string|undefined
}

/**
 * Instantiates a new Store configuration
 *
 * @return  {StoreOptions<ZettlrState>}  The instantiated store
 */
function getConfig (): StoreOptions<ZettlrState> {
  const config: StoreOptions<ZettlrState> = {
    state () {
      return {
        paneStructure: { type: 'leaf', id: '', openFiles: [], activeFile: null },
        paneData: [],
        fileTree: [],
        modifiedFiles: new Map(),
        lastFiletreeUpdate: 0,
        readabilityModeActive: [],
        activeFile: null,
        uncollapsedDirectories: [],
        selectedDirectory: null,
        relatedFiles: [],
        colouredTags: [],
        tagDatabase: [],
        tagSuggestions: [],
        config: configToArrayMapper(window.config.get()),
        activeDocumentInfo: null,
        modifiedDocuments: [],
        tableOfContents: null,
        citationKeys: [],
        bibliography: undefined,
        lastLeafId: undefined,
        distractionFreeMode: undefined,
        cslItems: [],
        searchResults: []
      }
    },
    getters: {
      file: state => (filePath: string): MDFileMeta|CodeFileMeta|OtherFileMeta|DirMeta|undefined => {
        return locateByPath(state.fileTree, filePath) as any
      },
      lastLeafActiveFile: state => (): OpenDocument|null => {
        const leaf = state.paneData.find(leaf => leaf.id === state.lastLeafId)
        if (leaf !== undefined) {
          return leaf.activeFile
        } else {
          return null
        }
      }
    },
    mutations: {
      updateTableOfContents: function (state, toc) {
        state.tableOfContents = toc
      },
      activeDocumentInfo: function (state, info) {
        state.activeDocumentInfo = info
      },
      lastLeafId: function (state, leafId: string|undefined) {
        state.lastLeafId = leafId
      },
      toggleDistractionFree: function (state) {
        if (state.distractionFreeMode === undefined && state.lastLeafId !== undefined) {
          state.distractionFreeMode = state.lastLeafId
        } else if (state.distractionFreeMode !== undefined && state.lastLeafId === state.distractionFreeMode) {
          state.distractionFreeMode = undefined
        } else if (state.distractionFreeMode !== undefined && state.lastLeafId !== state.distractionFreeMode) {
          state.distractionFreeMode = state.lastLeafId
        }
      },
      leaveDistractionFree: function (state) {
        if (state.distractionFreeMode !== undefined) {
          state.distractionFreeMode = undefined
        }
      },
      addUncollapsedDirectory: function (state, dirPath) {
        if (!state.uncollapsedDirectories.includes(dirPath)) {
          // In order for the reactivity to pick up on a changed state, we have
          // to literally deproxy and then re-assign. Proxies still have some
          // way to go.
          const oldUncollapsed = state.uncollapsedDirectories.map(e => e)
          oldUncollapsed.push(dirPath)
          state.uncollapsedDirectories = oldUncollapsed
        }
      },
      removeUncollapsedDirectory: function (state, dirPath) {
        const idx = state.uncollapsedDirectories.indexOf(dirPath)
        if (idx > -1) {
          const oldUncollapsed = state.uncollapsedDirectories.map(e => e)
          oldUncollapsed.splice(idx, 1)
          state.uncollapsedDirectories = oldUncollapsed
        }
      },
      addReadabilityActiveLeaf (state, leaf) {
        if (!state.readabilityModeActive.includes(leaf)) {
          state.readabilityModeActive.push(leaf)
        }
      },
      removeReadabilityActiveLeaf (state, leaf) {
        const idx = state.readabilityModeActive.indexOf(leaf)
        if (idx > -1) {
          state.readabilityModeActive.splice(idx, 1)
        }
      },
      updateConfig: function (state, option) {
        state.config[option] = window.config.get(option)
      },
      lastFiletreeUpdate: function (state, payload) {
        state.lastFiletreeUpdate = payload
      },
      updateRelatedFiles: function (state, relatedFiles: RelatedFile[]) {
        state.relatedFiles = relatedFiles
      },
      updateModifiedFiles: function (state, modifiedFiles: Map<string, number>) {
        state.modifiedFiles = modifiedFiles
      },
      colouredTags: function (state, tags) {
        state.colouredTags = tags
      },
      updateTagDatabase: function (state, tags) {
        state.tagDatabase = tags
      },
      setTagSuggestions: function (state, suggestions) {
        state.tagSuggestions = suggestions
      },
      updateCitationKeys: function (state, newKeys: string[]) {
        // Update the citations, removing possible duplicates
        state.citationKeys = [...new Set(newKeys)]
      },
      updateBibliography: function (state, bibliography) {
        state.bibliography = bibliography
      },
      updateCSLItems: function (state, newItems: any[]) {
        state.cslItems = newItems
      },
      clearSearchResults: function (state) {
        state.searchResults = []
      },
      addSearchResult: function (state, result: SearchResultWrapper) {
        state.searchResults.push(result)
        // Also make sure to sort the search results by relevancy (note the
        // b-a reversal, since we want a descending sort)
        state.searchResults.sort((a, b) => b.weight - a.weight)
      },
      documentTree: documentTreeMutation,
      // Longer mutations that require more code are defined externally
      updateOpenDirectory: updateOpenDirectoryMutation,
      addToFiletree: addToFiletreeMutation,
      patchInFiletree: patchInFiletreeMutation,
      removeFromFiletree: removeFromFiletreeMutation
    },
    actions: {
      filetreeUpdate: filetreeUpdateAction,
      updateOpenDirectory: updateOpenDirectoryAction,
      lastLeafId: async function (ctx, lastLeafId: string) {
        ctx.commit('lastLeafId', lastLeafId)
        // Update the tag suggestions
        await ctx.dispatch('regenerateTagSuggestions')
        // Update the related files
        await ctx.dispatch('updateRelatedFiles')
      },
      regenerateTagSuggestions: regenerateTagSuggestionsAction,
      updateRelatedFiles: updateRelatedFilesAction,
      updateBibliography: updateBibliographyAction,
      documentTree: documentTreeUpdateAction
    }
  }

  return config
}

/**
 * Returns a new Vuex Store
 *
 * @return  {Store<ZettlrState>}  The instantiated store
 */
export default function createStore (): Store<ZettlrState> {
  return baseCreateStore<ZettlrState>(getConfig())
}
