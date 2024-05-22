import { ApplicationRef, Component, ComponentFactoryResolver, Injector, NgZone } from '@angular/core';
import { Person } from './person';
import { GraphComponent, IArrow, ICommand, IGraph, INode, LayoutExecutorAsync, OrganicEdgeRouter, PolylineEdgeStyle, Size, TreeLayout, TreeReductionStage } from 'yfiles';
import { GraphComponentService } from './services/graph-component.service';
import { zoomDetail, zoomIntermediate } from './node.component';
import { NodeComponentStyle } from './NodeComponentStyle';
import { EDGE_DATA, NODE_DATA } from './data';
import { GraphSearch } from '../utils/GraphSearch';

// Run layout calculation on a Web Worker
let layoutWorker: Worker
if (typeof Worker != 'undefined') {
  // @ts-ignore
  layoutWorker = new Worker(new URL('./layout.worker.ts', import.meta.url), { type: 'module' })
}
@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent {
  title = 'graphYEd';

  public currentPerson!: Person
  private graphComponent!: GraphComponent
  searchString = ''
  graphSearch!: GraphSearch

  constructor(
    private _injector: Injector,
    private _resolver: ComponentFactoryResolver,
    private _appRef: ApplicationRef,
    private _zone: NgZone,
    private _graphComponentService: GraphComponentService
  ) {}

  ngAfterViewInit() {
    this.graphComponent = this._graphComponentService.getGraphComponent()

    // specify node and edge styles for newly created items
    this.setDefaultStyles(this.graphComponent.graph)

    // hook up the properties view panel with the current item of the graph
    this.graphComponent.addCurrentItemChangedListener(() => {
      this._zone.run(() => {
        this.currentPerson = this.graphComponent.currentItem!.tag
      })
    })

    // create a sample graph from data
    createSampleGraph(this.graphComponent.graph)
    this.graphComponent.fitGraphBounds()

    // Since the node component style runs "outside of angular", we have to
    // trigger change detection manually if the level of detail needs to change.
    let oldZoom = this.graphComponent.zoom
    this.graphComponent.addZoomChangedListener((_, evt) => {
      const newZoom = this.graphComponent.zoom
      if (
        (newZoom > zoomDetail && oldZoom <= zoomDetail) ||
        (newZoom <= zoomDetail && oldZoom > zoomDetail) ||
        (newZoom > zoomIntermediate && oldZoom <= zoomIntermediate) ||
        (newZoom <= zoomIntermediate && oldZoom > zoomIntermediate)
      ) {
        this._appRef.tick()
      }
      oldZoom = newZoom
    })

    // Run the layout animation outside angular zone, so no change detection
    // is initiated for listeners registered during the layout process.
    this._zone.runOutsideAngular(() => {
      // arrange the graph elements in a tree-like fashion
      runLayout(this.graphComponent)
    })

    // register the graph search
    this.graphSearch = new PersonSearch(this.graphComponent)
  }

  private setDefaultStyles(graph: IGraph) {
    graph.nodeDefaults.size = new Size(285, 100)
    graph.nodeDefaults.style = new NodeComponentStyle(
      this._injector,
      this._resolver,
      this._appRef,
      this._zone
    )

    graph.edgeDefaults.style = new PolylineEdgeStyle({
      stroke: '2px rgb(170, 170, 170)',
      targetArrow: IArrow.NONE
    })
  }

  zoomIn() {
    ICommand.INCREASE_ZOOM.execute(null, this.graphComponent)
  }

  zoomOriginal() {
    ICommand.ZOOM.execute(1, this.graphComponent)
  }

  zoomOut() {
    ICommand.DECREASE_ZOOM.execute(null, this.graphComponent)
  }

  fitContent() {
    ICommand.FIT_GRAPH_BOUNDS.execute(null, this.graphComponent)
  }

  onSearchInput(query: string) {
    this.graphSearch.updateSearch(query)
  }
}

function createSampleGraph(graph: IGraph): void {
  const nodeMap: { [name: string]: INode } = {}

  NODE_DATA.forEach((nodeData) => {
    nodeMap[nodeData.name] = graph.createNode({
      tag: new Person(nodeData)
    })
  })

  EDGE_DATA.forEach(({ from, to }) => {
    const fromNode = nodeMap[from]
    const toNode = nodeMap[to]
    if (fromNode && toNode) {
      graph.createEdge(fromNode, toNode)
    }
  })
}

async function runLayout(graphComponent: GraphComponent): Promise<void> {
  if (layoutWorker != null) {
    // run layout calculation in a Web Worker thread

    // helper function that performs the actual message passing to the web worker
    function webWorkerMessageHandler(data: unknown): Promise<any> {
      return new Promise((resolve) => {
        layoutWorker.onmessage = (e: any) => resolve(e.data)
        layoutWorker.postMessage(data)
      })
    }

    // create an asynchronous layout executor that calculates a layout on the worker
    const executor = new LayoutExecutorAsync({
      messageHandler: webWorkerMessageHandler,
      graphComponent,
      duration: '1s',
      easedAnimation: true,
      animateViewport: true
    })

    await executor.start()
  } else {
    // just run the layout calculation in the main thread
    const treeLayout = new TreeLayout()
    const treeReductionStage = new TreeReductionStage()
    treeReductionStage.nonTreeEdgeRouter = new OrganicEdgeRouter()
    treeReductionStage.nonTreeEdgeSelectionKey = OrganicEdgeRouter.AFFECTED_EDGES_DP_KEY

    treeLayout.appendStage(treeReductionStage)

    await graphComponent.morphLayout(treeLayout, '1s')
  }
}

class PersonSearch extends GraphSearch {
  override matches(node: INode, text: string): boolean {
    if (node.tag instanceof Person) {
      const person = node.tag
      return person.name.toLowerCase().indexOf(text.toLowerCase()) !== -1
    }
    return false
  }

}
